import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Award, UserMinus, Calendar, ShieldCheck, Dumbbell, Brain, HeartHandshake } from 'lucide-react';
import { ClubHistoryState, Player, PlayerRole, PlayerSeasonStat } from '../../types';
import { getPlayerFitnessStatus } from '../../utils/playerFitness';
import { getPersonalityArchetype, getPersonalityShortNote } from '../../utils/playerPersonality';
import { getPlayerProjectRole, getProjectRoleColor } from '../../utils/playerProjectRole';
import PlayerProfileModal from '../common/PlayerProfileModal';

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
}

type SortField = 'name' | 'role' | 'age' | 'overall' | 'form' | 'morale' | 'condition' | 'stamina' | 'value';

export default function Squad({ players, updatePlayer, starters, setStarters, bench, setBench, setPlayers, playerStats, clubHistory, currentRound }: SquadProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'STARTER' | 'INJURED' | 'SALE'>('ALL');
  const [sortField, setSortField] = useState<SortField>('overall');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerSheetMode, setPlayerSheetMode] = useState<'quick' | 'full'>('quick');
  const [teamTrainingFocus, setTeamTrainingFocus] = useState<'Forma' | 'Fisico' | 'Tecnica'>('Forma');
  const [positionTarget, setPositionTarget] = useState<PlayerRole>('CM');
  const roleContext = { starters, bench, seasonStats: playerStats, clubHistory, round: currentRound };

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

  // Sort & Filter logic
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filteredPlayers = players.filter(player => {
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
    setPlayerSheetMode('quick');
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

  const trainIndividual = (player: Player, focus: 'overall' | 'position') => {
    const projectRole = getPlayerProjectRole(player, roleContext);
    const youthBonus = player.age <= 21 ? 1.55 : player.age <= 24 ? 1.3 : player.age <= 28 ? 1 : 0.68;
    const projectGrowth = 1 + projectRole.growthModifier + (projectRole.trust - projectRole.tension) * 0.002;
    const conditionCost = focus === 'position' ? 8 : 6;

    if (focus === 'overall') {
      const canGrow = player.overall < player.potential;
      const gainChance = Math.min(0.88, Math.max(0.05, (0.28 * youthBonus + Math.max(0, player.potential - player.overall) * 0.06) * projectGrowth));
      const improves = canGrow && Math.random() < gainChance;
      const updated = {
        ...player,
        overall: improves ? player.overall + 1 : player.overall,
        form: Number(Math.min(10, player.form + 0.2 * youthBonus * Math.max(0.65, projectGrowth)).toFixed(1)),
        morale: Math.min(100, player.morale + (improves ? 5 : 2) + (projectRole.trust >= 70 ? 1 : 0)),
        condition: Math.max(35, player.condition - conditionCost),
        value: improves ? Math.round(player.value * 1.04) : player.value,
        status: player.condition - conditionCost < 60 ? 'Stanco' as const : player.status
      };
      updatePlayer(updated);
      setSelectedPlayer(updated);
      return;
    }

    if (player.role === 'GK') {
      alert('I portieri mantengono allenamento specifico: non possono imparare ruoli di movimento.');
      return;
    }
    if (positionTarget === player.role || player.secondaryRoles?.includes(positionTarget)) return;
    const current = player.positionTraining?.[positionTarget] ?? 0;
    const progressGain = Math.round(((player.age <= 21 ? 28 : player.age <= 24 ? 22 : player.age <= 28 ? 16 : 11) + Math.random() * 8) * Math.max(0.55, projectGrowth));
    const nextProgress = Math.min(100, current + progressGain);
    const learned = nextProgress >= 100;
    const updated = {
      ...player,
      secondaryRoles: learned ? Array.from(new Set([...(player.secondaryRoles ?? []), positionTarget])) : player.secondaryRoles,
      positionTraining: {
        ...(player.positionTraining ?? {}),
        [positionTarget]: learned ? 100 : nextProgress
      },
      morale: Math.min(100, player.morale + (learned ? 6 : 2)),
      condition: Math.max(35, player.condition - conditionCost),
      status: player.condition - conditionCost < 60 ? 'Stanco' as const : player.status
    };
    updatePlayer(updated);
    setSelectedPlayer(updated);
  };

  const runTeamTraining = () => {
    const trained = players.map(player => {
      const projectRole = getPlayerProjectRole(player, roleContext);
      const projectGrowth = 1 + projectRole.growthModifier + (projectRole.trust - projectRole.tension) * 0.0015;
      const youthBonus = player.age <= 23 ? 1.25 : player.age <= 28 ? 1 : 0.75;
      const formGain = teamTrainingFocus === 'Forma' ? 0.25 * youthBonus * Math.max(0.65, projectGrowth) : 0.08;
      const moraleGain = teamTrainingFocus === 'Tecnica' ? 2 : 1;
      const conditionChange = teamTrainingFocus === 'Fisico' ? 3 : -4;
      const canImprove = teamTrainingFocus === 'Tecnica' && player.overall < player.potential && Math.random() < Math.max(0.02, 0.08 * youthBonus * projectGrowth);

      return {
        ...player,
        overall: canImprove ? player.overall + 1 : player.overall,
        form: Number(Math.min(10, player.form + formGain).toFixed(1)),
        morale: Math.min(100, Math.max(0, player.morale + moraleGain + (projectRole.tension >= 75 ? -1 : projectRole.trust >= 72 ? 1 : 0))),
        condition: Math.max(40, Math.min(100, player.condition + conditionChange)),
        value: canImprove ? Math.round(player.value * 1.03) : player.value,
        status: player.condition + conditionChange < 60 ? 'Stanco' as const : player.condition + conditionChange >= 85 && player.status === 'Stanco' ? 'Disponibile' as const : player.status
      };
    });
    setPlayers(trained);
    if (selectedPlayer) setSelectedPlayer(trained.find(player => player.id === selectedPlayer.id) ?? selectedPlayer);
  };

  // Prefer detailed Excel attributes; fall back to role-based generated values for older rosters.
  const getAttributes = (player: Player) => {
    const sourceAttributes = Object.entries(player.attributes ?? {})
      .filter(([, value]) => Number.isFinite(value))
      .map(([label, val]) => ({ label, val }));

    if (sourceAttributes.length) return sourceAttributes;

    const isGK = player.role === 'GK';
    const isDF = ['CB', 'LB', 'RB'].includes(player.role);
    const isMF = ['DM', 'CM', 'AM'].includes(player.role);
    
    // Generate realistic sub-attributes
    if (isGK) {
      return [
        { label: 'Riflessi', val: player.overall + 3 },
        { label: 'Presa', val: player.overall - 1 },
        { label: 'Rinvio', val: player.overall - 4 },
        { label: 'Piazzamento', val: player.overall },
        { label: 'Uscite', val: player.overall - 2 },
        { label: 'Presenza Fisica', val: player.overall - 3 }
      ];
    } else if (isDF) {
      return [
        { label: 'Velocità', val: player.overall - 6 },
        { label: 'Forza', val: player.overall + 5 },
        { label: 'Marcatura', val: player.overall + 2 },
        { label: 'Scivolata', val: player.overall + 1 },
        { label: 'Colpo di Testa', val: player.overall + 4 },
        { label: 'Passaggio', val: player.overall - 10 }
      ];
    } else if (isMF) {
      return [
        { label: 'Velocità', val: player.overall - 2 },
        { label: 'Resistenza', val: player.overall + 6 },
        { label: 'Pass. Corto', val: player.overall + 4 },
        { label: 'Pass. Lungo', val: player.overall + 2 },
        { label: 'Visione', val: player.overall + 1 },
        { label: 'Dribbling', val: player.overall - 1 }
      ];
    } else { // FW / ST
      return [
        { label: 'Velocità', val: player.overall + 5 },
        { label: 'Dribbling', val: player.overall + 3 },
        { label: 'Tiro', val: player.overall + 4 },
        { label: 'Colpo di Testa', val: player.overall - 4 },
        { label: 'Posizionamento', val: player.overall + 2 },
        { label: 'Forza', val: player.overall - 5 }
      ];
    }
  };

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
      </div>

      <div className="card-premium" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Dumbbell size={16} style={{ color: 'var(--color-pitch)' }} />
            Allenamento di Squadra
          </h3>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Forma migliora il rendimento immediato, Fisico recupera condizione, Tecnica puo far crescere soprattutto i giovani.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={teamTrainingFocus} onChange={e => setTeamTrainingFocus(e.target.value as typeof teamTrainingFocus)} style={selectStyle}>
            <option value="Forma">Forma partita</option>
            <option value="Fisico">Recupero fisico</option>
            <option value="Tecnica">Tecnica e crescita</option>
          </select>
          <button className="btn-primary" onClick={runTeamTraining} style={{ justifyContent: 'center' }}>
            Avvia seduta
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
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.map((player) => {
              const isStarter = starters.includes(player.id);
              const fitness = getPlayerFitnessStatus(player);
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
                    }`} style={{ display: 'inline-block', width: '85px', textAlign: 'center' }}>
                      {player.status}
                    </span>
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
        contextLabel="Scheda rapida rosa"
      />

      {/* Roster Drawer Details Panel */}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Valore di Mercato:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(selectedPlayer.value)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Stipendio Settimanale:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(selectedPlayer.wage)}/sett</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Scadenza Contratto:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{selectedPlayer.contractYears} anni rimasti</strong>
                  </div>
                </div>

                <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Dumbbell size={14} />
                    Allenamento Individuale
                  </h4>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                    I giovani apprendono piu velocemente. Un nuovo ruolo diventa utile in partita quando arriva al 100%.
                  </p>
                  <button className="btn-secondary" onClick={() => trainIndividual(selectedPlayer, 'overall')} style={{ justifyContent: 'center' }}>
                    Migliora tecnica/overall
                  </button>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'end' }}>
                    <div>
                      <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Nuova posizione</label>
                      <select value={positionTarget} onChange={e => setPositionTarget(e.target.value as PlayerRole)} style={selectStyle}>
                        {(['CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'] as PlayerRole[]).map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>
                    <button className="btn-primary" onClick={() => trainIndividual(selectedPlayer, 'position')} style={{ justifyContent: 'center' }}>
                      Allena
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Ruoli secondari: <strong>{selectedPlayer.secondaryRoles?.join(', ') || 'nessuno'}</strong>
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Progresso {positionTarget}: <strong style={{ color: 'var(--color-lime)' }}>{selectedPlayer.positionTraining?.[positionTarget] ?? 0}%</strong>
                    </span>
                  </div>
                </div>

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
                  onClick={() => {
                    const newYears = selectedPlayer.contractYears + 2;
                    const newWage = Math.round(selectedPlayer.wage * 1.1);
                    updatePlayer({ ...selectedPlayer, contractYears: newYears, wage: newWage, morale: Math.min(selectedPlayer.morale + 15, 100) });
                    setSelectedPlayer(null);
                  }}
                  className="btn-secondary"
                  style={{ justifyContent: 'center' }}
                >
                  <Calendar size={16} />
                  Rinnova Contratto (+2 Anni, +10% stipendio)
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
