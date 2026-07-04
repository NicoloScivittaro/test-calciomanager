import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, Save, Sparkles, UserCheck, Shield, Zap } from 'lucide-react';
import { Player, Tactic, TeamDNAState } from '../../types';
import { evaluateTactic, getRoleFitScore } from '../../utils/tacticsEngine';
import { selectBestLineupForModule } from '../../utils/squadSelection';
import { getTacticalDNAAlignment, TEAM_DNA_DEFINITIONS } from '../../utils/teamDNA';
import PlayerProfileModal from '../common/PlayerProfileModal';

interface TacticsProps {
  players: Player[];
  tactic: Tactic;
  saveTactic: (tactic: Tactic) => void;
  starters: string[];
  setStarters: (ids: string[]) => void;
  bench: string[];
  setBench: (ids: string[]) => void;
  teamDNA: TeamDNAState;
}

interface PitchPosition {
  x: number; // percent from left
  y: number; // percent from top
  role: string;
}

export default function Tactics({ players, tactic, saveTactic, starters, setStarters, bench, setBench, teamDNA }: TacticsProps) {
  const [module, setModule] = useState<'4-3-3' | '4-2-3-1' | '3-5-2'>(tactic.module);
  const [mentality, setMentality] = useState<'Difensiva' | 'Bilanciata' | 'Offensiva'>(tactic.mentality);
  const [pressing, setPressing] = useState(tactic.pressing);
  const [tempo, setTempo] = useState(tactic.tempo);
  const [width, setWidth] = useState(tactic.width);
  const [buildUp, setBuildUp] = useState<'Lancio Lungo' | 'Manovrata' | 'Mista'>(tactic.buildUp);
  const [defensiveLine, setDefensiveLine] = useState(tactic.defensiveLine);
  const [riskLevel, setRiskLevel] = useState(tactic.riskLevel);
  const [chanceCreation, setChanceCreation] = useState<Tactic['chanceCreation']>(tactic.chanceCreation);
  const [marking, setMarking] = useState<Tactic['marking']>(tactic.marking);
  const [transition, setTransition] = useState<Tactic['transition']>(tactic.transition);
  const [attackingFocus, setAttackingFocus] = useState<Tactic['attackingFocus']>(tactic.attackingFocus);
  const [principles, setPrinciples] = useState<Tactic['principles']>(tactic.principles ?? ['deepPlaymaker']);
  const [gamePlan, setGamePlan] = useState<Tactic['gamePlan']>(tactic.gamePlan ?? {
    whenLeading: 'Equilibrio',
    whenTrailing: 'Spingi',
    whenRedCard: 'Compatto'
  });
  
  // Selected starter for swap overlay
  const [swappingStarterIndex, setSwappingStarterIndex] = useState<number | null>(null);
  const [playerSheet, setPlayerSheet] = useState<{ player: Player; mode: 'quick' | 'full' } | null>(null);

  // Position presets
  const positionPresets: Record<'4-3-3' | '4-2-3-1' | '3-5-2', PitchPosition[]> = {
    '4-3-3': [
      { x: 50, y: 88, role: 'GK' },
      { x: 35, y: 72, role: 'CB' },
      { x: 65, y: 72, role: 'CB' },
      { x: 15, y: 66, role: 'LB' },
      { x: 85, y: 66, role: 'RB' },
      { x: 50, y: 55, role: 'DM' },
      { x: 32, y: 44, role: 'CM' },
      { x: 68, y: 44, role: 'CM' },
      { x: 20, y: 22, role: 'LW' },
      { x: 80, y: 22, role: 'RW' },
      { x: 50, y: 14, role: 'ST' }
    ],
    '4-2-3-1': [
      { x: 50, y: 88, role: 'GK' },
      { x: 35, y: 72, role: 'CB' },
      { x: 65, y: 72, role: 'CB' },
      { x: 15, y: 66, role: 'LB' },
      { x: 85, y: 66, role: 'RB' },
      { x: 38, y: 56, role: 'DM' },
      { x: 62, y: 56, role: 'DM' },
      { x: 50, y: 38, role: 'AM' },
      { x: 20, y: 22, role: 'LW' },
      { x: 80, y: 22, role: 'RW' },
      { x: 50, y: 14, role: 'ST' }
    ],
    '3-5-2': [
      { x: 50, y: 88, role: 'GK' },
      { x: 50, y: 74, role: 'CB' },
      { x: 28, y: 72, role: 'CB' },
      { x: 72, y: 72, role: 'CB' },
      { x: 50, y: 54, role: 'DM' },
      { x: 32, y: 44, role: 'CM' },
      { x: 68, y: 44, role: 'CM' },
      { x: 15, y: 36, role: 'LB' }, // Winger/Wingback left
      { x: 85, y: 36, role: 'RB' }, // Winger/Wingback right
      { x: 38, y: 16, role: 'ST' },
      { x: 62, y: 16, role: 'ST' }
    ]
  };

  const currentPositions = positionPresets[module];

  // Map starter IDs to actual players
  const startingPlayers = starters.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
  // Bench players list
  const benchPlayers = bench.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];

  const draftTactic: Tactic = {
    module,
    mentality,
    pressing,
    tempo,
    width,
    buildUp,
    defensiveLine,
    riskLevel,
    chanceCreation,
    marking,
    transition,
    attackingFocus,
    principles,
    gamePlan,
    familiarity: tactic.familiarity ?? 35,
    styleSignature: tactic.styleSignature,
    lineupCore: tactic.lineupCore,
    starters,
    bench
  };
  const tacticalReport = evaluateTactic(players, starters, draftTactic);
  const { compatibility, cohesion } = tacticalReport;
  const dnaDefinition = TEAM_DNA_DEFINITIONS[teamDNA.active];
  const dnaAlignment = getTacticalDNAAlignment(teamDNA, draftTactic);

  const togglePrinciple = (principle: NonNullable<Tactic['principles']>[number]) => {
    setPrinciples(current => (
      current?.includes(principle)
        ? current.filter(item => item !== principle)
        : [...(current ?? []), principle]
    ));
  };

  const handleSwap = (benchPlayerId: string) => {
    if (swappingStarterIndex === null) return;
    
    const newStarters = [...starters];
    const newBench = [...bench];
    
    const oldStarterId = starters[swappingStarterIndex];
    
    // Swap IDs
    newStarters[swappingStarterIndex] = benchPlayerId;
    const benchIndex = bench.indexOf(benchPlayerId);
    newBench[benchIndex] = oldStarterId;
    
    setStarters(newStarters);
    setBench(newBench);
    setSwappingStarterIndex(null);
  };

  const openPlayerSheet = (event: React.MouseEvent, player: Player) => {
    event.stopPropagation();
    setPlayerSheet({ player, mode: 'quick' });
  };

  const handleSave = () => {
    saveTactic({
      module,
      mentality,
      pressing,
      tempo,
      width,
      buildUp,
      defensiveLine,
      riskLevel,
      chanceCreation,
      marking,
      transition,
      attackingFocus,
      principles,
      gamePlan,
      familiarity: tactic.familiarity ?? 35,
      styleSignature: tactic.styleSignature,
      lineupCore: tactic.lineupCore,
      starters,
      bench
    });
    alert('Strategia tattica salvata con successo!');
  };

  const handleQuickSelection = () => {
    const selection = selectBestLineupForModule(players, module);
    setStarters(selection.starters);
    setBench(selection.bench);
    saveTactic({
      module,
      mentality,
      pressing,
      tempo,
      width,
      buildUp,
      defensiveLine,
      riskLevel,
      chanceCreation,
      marking,
      transition,
      attackingFocus,
      principles,
      gamePlan,
      familiarity: tactic.familiarity ?? 35,
      styleSignature: tactic.styleSignature,
      lineupCore: tactic.lineupCore,
      starters: selection.starters,
      bench: selection.bench
    });
  };

  // Re-fill starters to exactly 11 if mismatch occurs (e.g. initial load)
  useEffect(() => {
    if (starters.length < 11) {
      const extraNeeded = 11 - starters.length;
      const availableFromBench = bench.slice(0, extraNeeded);
      setStarters([...starters, ...availableFromBench]);
      setBench(bench.slice(extraNeeded));
    }
  }, [starters, bench, setBench, setStarters]);

  return (
    <div className="page-wrapper tactics-layout">
      {/* Left side: Interactive Football Pitch Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Pitch Card */}
        <div className="pitch-container">
          {/* Tactical lines drawn inside the green field */}
          <div className="pitch-line pitch-midline" />
          <div className="pitch-line pitch-center-circle" />
          <div className="pitch-line pitch-penalty-area-top" />
          <div className="pitch-line pitch-penalty-area-bottom" />
          <div className="pitch-line pitch-goal-area-top" />
          <div className="pitch-line pitch-goal-area-bottom" />

          {/* Render 11 nodes */}
          {startingPlayers.map((player, index) => {
            const pos = currentPositions[index] || { x: 50, y: 50, role: 'CM' };
            const isSelected = swappingStarterIndex === index;
            const roleFit = getRoleFitScore(player.role, pos.role as Player['role']);
            const fitColor = roleFit >= 0.92 ? 'var(--color-pitch)' : roleFit >= 0.65 ? 'var(--color-gold)' : 'var(--color-danger)';

            return (
              <motion.div
                key={player.id}
                layout
                onClick={() => setSwappingStarterIndex(isSelected ? null : index)}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                }}
                className="pitch-player-node"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 220, damping: 20 }}
              >
                <div className={`pitch-player-shirt ${isSelected ? 'active-drag' : ''}`} style={{
                  borderColor: fitColor
                }}>
                  {player.overall}
                  <span className="pitch-player-role" style={{
                    backgroundColor: fitColor
                  }}>
                    {pos.role}
                  </span>
                </div>
                <button
                  className="pitch-player-profile-trigger"
                  onClick={event => openPlayerSheet(event, player)}
                  title={`Apri scheda di ${player.name}`}
                >
                  <Info size={10} />
                  {player.name.split(' ').slice(-1)[0]}
                </button>
                <span className="pitch-player-overall" style={{ color: roleFit >= 0.92 ? 'var(--text-muted)' : fitColor }}>
                  {player.role}
                </span>
              </motion.div>
            );
          })}

          {/* Swap Overlay selection drawer inside pitch */}
          <AnimatePresence>
            {swappingStarterIndex !== null && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '20px',
                  right: '20px',
                  backgroundColor: 'rgba(10, 13, 16, 0.95)',
                  border: '1px solid var(--color-pitch)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  zIndex: 40,
                  boxShadow: 'var(--shadow-md)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    Sostituisci <span style={{ color: 'var(--color-pitch)' }}>{startingPlayers[swappingStarterIndex]?.name}</span> ({currentPositions[swappingStarterIndex]?.role}) con:
                  </p>
                  <button
                    onClick={() => setSwappingStarterIndex(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                  >
                    Annulla
                  </button>
                </div>

                {/* Horizontal scroll list of bench substitutes */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {benchPlayers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSwap(p.id)}
                      style={{
                        flexShrink: 0,
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        transition: 'border-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-lime)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
                    >
                      <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{p.name.split(' ').slice(-1)[0]}</span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '0.65rem' }}>
                        <span className={`badge badge-${p.role === 'GK' ? 'GK' : p.role.match(/CB|LB|RB/) ? 'DF' : p.role.match(/DM|CM|AM/) ? 'MF' : 'FW'}`} style={{ padding: '0 3px' }}>{p.role}</span>
                        <span style={{ color: 'var(--color-lime)' }}>{p.overall}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Cohesion Score card */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div className="card-premium" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-pitch)'
            }}>
              <Shield size={20} />
            </div>
            <div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Intesa Tattica</p>
              <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>{compatibility}%</p>
            </div>
          </div>

          <div className="card-premium" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-gold)'
            }}>
              <Zap size={20} />
            </div>
            <div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Affiatamento Squadra</p>
              <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>{cohesion}%</p>
            </div>
          </div>

          <div className="card-premium" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: 'rgba(96, 165, 250, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#93C5FD'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Automatismi</p>
              <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>{tacticalReport.automatisms}%</p>
            </div>
          </div>
        </div>

        <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: tacticalReport.warnings.length ? 'var(--color-gold)' : 'var(--color-pitch)' }} />
            Lettura Tattica
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '8px' }}>
            {[
              ['Attacco', tacticalReport.attack],
              ['Centrocampo', tacticalReport.midfield],
              ['Difesa', tacticalReport.defense],
              ['Carico', tacticalReport.fatigueLoad],
              ['Rischio', tacticalReport.opponentRisk]
            ].map(([label, value]) => (
              <div key={label} style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(26,33,42,0.24)', textAlign: 'center' }}>
                <p style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</p>
                <strong style={{ fontSize: '1rem', color: (label === 'Carico' && Number(value) > 24) || (label === 'Rischio' && Number(value) > 68) ? 'var(--color-gold)' : 'var(--text-primary)' }}>{value}</strong>
              </div>
            ))}
          </div>
          {tacticalReport.principleReports.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tacticalReport.principleReports.map(report => (
                <div key={report.key} style={{ padding: '9px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.18)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '5px' }}>
                    <strong style={{ fontSize: '0.74rem' }}>{report.label}</strong>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: report.score >= 68 ? 'var(--color-pitch)' : report.score >= 56 ? 'var(--color-gold)' : 'var(--color-danger)' }}>
                      {report.score}/100
                    </span>
                  </div>
                  <div style={{ height: '5px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: '6px' }}>
                    <div style={{ width: `${report.score}%`, height: '100%', background: report.score >= 68 ? 'var(--color-pitch)' : report.score >= 56 ? 'var(--color-gold)' : 'var(--color-danger)' }} />
                  </div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>{report.note}</p>
                </div>
              ))}
            </div>
          )}
          {tacticalReport.explanations.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {tacticalReport.explanations.slice(0, 3).map(explanation => (
                <p key={explanation} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                  <strong style={{ color: 'var(--color-pitch)' }}>Lettura:</strong> {explanation}
                </p>
              ))}
            </div>
          )}
          {tacticalReport.warnings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tacticalReport.warnings.slice(0, 3).map((warning) => (
                <p key={warning} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                  <strong style={{ color: 'var(--color-gold)' }}>Attenzione:</strong> {warning}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} style={{ color: dnaDefinition.color }} />
                DNA squadra
              </h3>
              <strong style={{ display: 'block', marginTop: '6px', fontSize: '0.88rem' }}>{dnaDefinition.name}</strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.42, marginTop: '4px' }}>{dnaDefinition.description}</p>
            </div>
            <span style={{ color: dnaAlignment >= 70 ? 'var(--color-pitch)' : dnaAlignment >= 48 ? 'var(--color-gold)' : 'var(--color-danger)', fontWeight: 900 }}>
              {dnaAlignment}%
            </span>
          </div>
          <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ width: `${dnaAlignment}%`, height: '100%', background: dnaDefinition.color }} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', lineHeight: 1.38 }}>
            Salva spesso piani coerenti e il club diventa riconoscibile. Se il piano va contro il DNA, rendimento e umore possono calare.
          </p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[teamDNA.active, ...teamDNA.secondary].map(key => (
              <span key={key} className="badge" style={{ color: TEAM_DNA_DEFINITIONS[key].color, background: 'rgba(26,33,42,0.45)' }}>
                {TEAM_DNA_DEFINITIONS[key].shortName} {Math.round(teamDNA.scores[key])}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* Right side: Strategy Control deck */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Module selection card */}
        <div className="card-premium">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} style={{ color: 'var(--color-gold)' }} />
            Schema e Allineamento
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Modulo Principale</label>
              <select
                value={module}
                onChange={e => setModule(e.target.value as any)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  fontWeight: 600
                }}
              >
                <option value="4-3-3">4-3-3 (Olandese classico - Attacco sulle ali)</option>
                <option value="4-2-3-1">4-2-3-1 (Moderna fluidità - Trequartista perno)</option>
                <option value="3-5-2">3-5-2 (Solidità difensiva - Spinta sulle fasce)</option>
              </select>
            </div>

            <button
              onClick={handleQuickSelection}
              className="btn-secondary"
              style={{ justifyContent: 'center', fontSize: '0.8rem' }}
            >
              <Sparkles size={14} />
              Selezione formazione rapida
            </button>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Mentalità di Gioco</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['Difensiva', 'Bilanciata', 'Offensiva'].map(ment => (
                  <button
                    key={ment}
                    onClick={() => setMentality(ment as any)}
                    style={{
                      flex: 1,
                      backgroundColor: mentality === ment ? 'var(--color-pitch)' : 'var(--bg-surface-elevated)',
                      color: mentality === ment ? '#042F1A' : 'var(--text-primary)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 0',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    {ment}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sliders Instructions card */}
        <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={16} style={{ color: 'var(--color-pitch)' }} />
            Istruzioni Tattiche
          </h3>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Intensità Pressing</span>
              <strong style={{ color: 'var(--color-lime)' }}>{pressing}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={pressing}
              onChange={e => setPressing(Number(e.target.value))}
              className="tactic-slider"
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Ritmo di Gioco</span>
              <strong style={{ color: 'var(--color-lime)' }}>{tempo}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={tempo}
              onChange={e => setTempo(Number(e.target.value))}
              className="tactic-slider"
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Ampiezza Manovra</span>
              <strong style={{ color: 'var(--color-lime)' }}>{width}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={width}
              onChange={e => setWidth(Number(e.target.value))}
              className="tactic-slider"
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Linea Difensiva</span>
              <strong style={{ color: 'var(--color-lime)' }}>{defensiveLine}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={defensiveLine}
              onChange={e => setDefensiveLine(Number(e.target.value))}
              className="tactic-slider"
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Rischio Offensivo</span>
              <strong style={{ color: riskLevel > 72 ? 'var(--color-gold)' : 'var(--color-lime)' }}>{riskLevel}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={riskLevel}
              onChange={e => setRiskLevel(Number(e.target.value))}
              className="tactic-slider"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Costruzione dal Basso</label>
            <select
              value={buildUp}
              onChange={e => setBuildUp(e.target.value as any)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                fontWeight: 600
              }}
            >
              <option value="Manovrata">Costruzione Manovrata (Passaggi corti)</option>
              <option value="Mista">Mista (Adattiva alla difesa avversaria)</option>
              <option value="Lancio Lungo">Lancio Lungo (Verticalizzazioni rapide)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Creazione Occasioni</label>
            <select
              value={chanceCreation}
              onChange={e => setChanceCreation(e.target.value as Tactic['chanceCreation'])}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                fontWeight: 600
              }}
            >
              <option value="Passaggi Filtranti">Passaggi Filtranti (AM e punta premiati)</option>
              <option value="Tagli Interni">Tagli Interni (ali a piede invertito)</option>
              <option value="Cross">Cross (terzini, ali e punta fisica)</option>
              <option value="Tiri da Fuori">Tiri da Fuori (mezzali e trequartista)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Marcatura</label>
            <select
              value={marking}
              onChange={e => setMarking(e.target.value as Tactic['marking'])}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                fontWeight: 600
              }}
            >
              <option value="Zona">Zona (premia intesa e ordine)</option>
              <option value="Uomo">Uomo (duelli forti, piu falli e fatica)</option>
              <option value="Mista">Mista (compromesso)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Transizione</label>
            <select
              value={transition}
              onChange={e => setTransition(e.target.value as Tactic['transition'])}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                fontWeight: 600
              }}
            >
              <option value="Riaggressione">Riaggressione (pressing e recupero alto)</option>
              <option value="Contropiede">Contropiede (campo aperto e velocita)</option>
              <option value="Conservativa">Conservativa (meno rischi, meno strappi)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Focus Offensivo</label>
            <select
              value={attackingFocus}
              onChange={e => setAttackingFocus(e.target.value as Tactic['attackingFocus'])}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                fontWeight: 600
              }}
            >
              <option value="Equilibrato">Equilibrato</option>
              <option value="Fasce">Fasce</option>
              <option value="Centro">Centro</option>
            </select>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 800, marginBottom: '10px' }}>Principi chiave</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '7px' }}>
              {[
                ['overlaps', 'Sovrapposizioni', 'Terzini/quinti alti: piu ampiezza, piu fatica.'],
                ['falseNine', 'Falso nove', 'La punta lega il gioco: meglio se tecnica, meno cross.'],
                ['mezzalaRuns', 'Mezzala inserimento', 'Attacca l area dal centro, ma scopre transizioni.'],
                ['deepPlaymaker', 'Regista basso', 'Uscita pulita e controllo, ritmo piu ragionato.'],
                ['manMarkKey', 'Marcatore chiave', 'Uomo sul loro creativo: duelli, falli e meno spazio tra le linee.']
              ].map(([key, title, text]) => {
                const active = principles?.includes(key as NonNullable<Tactic['principles']>[number]);
                return (
                  <button
                    key={key}
                    onClick={() => togglePrinciple(key as NonNullable<Tactic['principles']>[number])}
                    style={{
                      textAlign: 'left',
                      padding: '9px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${active ? 'var(--color-pitch)' : 'var(--border-light)'}`,
                      background: active ? 'rgba(16,185,129,0.1)' : 'rgba(26,33,42,0.2)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: '0.75rem' }}>{title}</strong>
                    <span style={{ display: 'block', fontSize: '0.66rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginTop: '2px' }}>{text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 800, marginBottom: '10px' }}>Piano partita</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Se sei avanti</label>
                <select value={gamePlan?.whenLeading ?? 'Equilibrio'} onChange={e => setGamePlan(current => ({ ...(current ?? { whenLeading: 'Equilibrio', whenTrailing: 'Spingi', whenRedCard: 'Compatto' }), whenLeading: e.target.value as NonNullable<Tactic['gamePlan']>['whenLeading'] }))} style={{ width: '100%', marginTop: '4px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '9px', color: 'var(--text-primary)' }}>
                  <option value="Proteggi">Proteggi</option>
                  <option value="Equilibrio">Equilibrio</option>
                  <option value="Spingi">Spingi</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Se stai perdendo</label>
                <select value={gamePlan?.whenTrailing ?? 'Spingi'} onChange={e => setGamePlan(current => ({ ...(current ?? { whenLeading: 'Equilibrio', whenTrailing: 'Spingi', whenRedCard: 'Compatto' }), whenTrailing: e.target.value as NonNullable<Tactic['gamePlan']>['whenTrailing'] }))} style={{ width: '100%', marginTop: '4px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '9px', color: 'var(--text-primary)' }}>
                  <option value="Proteggi">Proteggi</option>
                  <option value="Equilibrio">Equilibrio</option>
                  <option value="Spingi">Spingi</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Se prendi rosso</label>
                <select value={gamePlan?.whenRedCard ?? 'Compatto'} onChange={e => setGamePlan(current => ({ ...(current ?? { whenLeading: 'Equilibrio', whenTrailing: 'Spingi', whenRedCard: 'Compatto' }), whenRedCard: e.target.value as NonNullable<Tactic['gamePlan']>['whenRedCard'] }))} style={{ width: '100%', marginTop: '4px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '9px', color: 'var(--text-primary)' }}>
                  <option value="Blocco basso">Blocco basso</option>
                  <option value="Compatto">Compatto</option>
                  <option value="Rischia">Rischia</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Trigger Save */}
          <button
            onClick={handleSave}
            className="btn-primary"
            style={{ marginTop: '10px', justifyContent: 'center' }}
          >
            <Save size={16} fill="#042F1A" />
            Salva Tattica & Formazione
          </button>
        </div>

      </div>

      <PlayerProfileModal
        player={playerSheet?.player ?? null}
        mode={playerSheet?.mode ?? 'quick'}
        onClose={() => setPlayerSheet(null)}
        onModeChange={mode => setPlayerSheet(current => current ? { ...current, mode } : current)}
        players={players}
        starters={starters}
        bench={bench}
        contextLabel="Lavagna tattica"
      />
    </div>
  );
}
