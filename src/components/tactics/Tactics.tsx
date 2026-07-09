import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, Save, Sparkles, UserCheck, Shield, Zap } from 'lucide-react';
import { Player, PlayerInstructionRole, SlotInstruction, Tactic, TeamDNAState } from '../../types';
import {
  applyInstructionPreset,
  evaluatePlayerInstructionFit,
  evaluateTactic,
  FormationTacticalModifiers,
  getDefaultSlotInstructions,
  getFormationCompatibilityReport,
  getRoleFitScore,
  INSTRUCTION_PRESET_LABELS,
  InstructionPresetId,
  mergeSlotInstructionsForModule,
  PLAYER_INSTRUCTION_ROLE_META,
  POSITION_PRESETS,
  FORMATION_LIBRARY
} from '../../utils/tacticsEngine';
import { selectBestLineupForModule } from '../../utils/squadSelection';
import { getTacticalDNAAlignment, TEAM_DNA_DEFINITIONS } from '../../utils/teamDNA';
import { getPlayerAvailabilitySummary } from '../../utils/playerFitness';
import { getRoleFamiliarityEntry, ROLE_FAMILIARITY_STATUS_LABELS } from '../../utils/playerDevelopment';
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

export default function Tactics({ players, tactic, saveTactic, starters, setStarters, bench, setBench, teamDNA }: TacticsProps) {
  const [module, setModule] = useState<Tactic['module']>(tactic.module);
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

  // T2: istruzioni per slot (ruolo/compito). Vecchio salvataggio senza istruzioni -> default coerenti
  // dal modulo attuale, mai un reset delle altre impostazioni tattiche.
  const [slotInstructions, setSlotInstructions] = useState<Record<string, SlotInstruction>>(
    tactic.slotInstructions ?? getDefaultSlotInstructions(tactic.module)
  );

  const handleModuleChange = (nextModule: Tactic['module']) => {
    setModule(nextModule);
    setSlotInstructions(current => mergeSlotInstructionsForModule(current, nextModule));
  };

  const updateSlotInstruction = (slotId: string, changes: Partial<SlotInstruction>) => {
    setSlotInstructions(current => ({
      ...current,
      [slotId]: { ...current[slotId], ...changes }
    }));
  };

  const applyPreset = (preset: InstructionPresetId) => {
    setSlotInstructions(current => applyInstructionPreset(current, module, preset));
  };

  // T1: coordinate/slot per modulo, unica fonte di verita' condivisa con tacticsEngine/match engine/
  // live viewer (nessuna copia locale duplicata, cosi' tutti i 26 moduli restano coerenti ovunque).
  const currentPositions = POSITION_PRESETS[module];
  const currentFormationMeta = FORMATION_LIBRARY[module];
  const formationCompatibility = getFormationCompatibilityReport(players, module);

  // Map starter IDs to actual players
  const startingPlayers = starters.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
  // Bench players list
  const benchPlayers = bench.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
  // Infortunati/rientro-in-gruppo non sono selezionabili per un cambio; il rientro controllato lo e', con avviso.
  const swappableBenchPlayers = benchPlayers.filter(p => p.status !== 'Infortunato');

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
    slotInstructions,
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

  // T2: ogni slot con il giocatore titolare assegnato (per indice, coerente con evaluateTactic) e la
  // sua istruzione ruolo/compito, per l'editor e per il pannello "Impatto tattico" qui sotto.
  const slotsWithInstructions = currentPositions.map((slot, index) => {
    const slotId = `slot_${index}`;
    const instruction = slotInstructions[slotId] ?? { slotId, role: 'central_midfielder' as const, duty: 'support' as const };
    const assignedPlayer = startingPlayers[index];
    const fit = assignedPlayer ? evaluatePlayerInstructionFit(assignedPlayer, slot.role, instruction, draftTactic) : null;
    return { slot, index, slotId, instruction, assignedPlayer, fit };
  });

  // Solo per il pannello riassuntivo: formazione + media delle istruzioni scelte sui titolari attuali.
  // Non e' l'output ufficiale (quello resta tacticalReport/evaluateTactic), solo una lettura rapida.
  const impactAxis = (getter: (m: FormationTacticalModifiers) => number) => Math.round(
    getter(currentFormationMeta.tacticalModifiers) +
    slotsWithInstructions.reduce((sum, entry) => sum + (entry.assignedPlayer ? getter(PLAYER_INSTRUCTION_ROLE_META[entry.instruction.role].modifiers) : 0), 0) / 3
  );
  const tacticalImpact = {
    wingThreat: impactAxis(m => m.wingThreat),
    centralControl: impactAxis(m => m.centralControl),
    pressingPotential: impactAxis(m => m.pressingPotential),
    defensiveTransitionRisk: impactAxis(m => m.defensiveTransitionRisk),
    chanceCreation: impactAxis(m => m.chanceCreation),
    defensiveSolidity: impactAxis(m => m.defensiveSolidity)
  };

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
      slotInstructions,
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
    const selection = selectBestLineupForModule(players, module, slotInstructions);
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
      slotInstructions,
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
            const availability = getPlayerAvailabilitySummary(player);
            const availabilityBadge =
              availability.label === 'Indisponibile' ? { text: 'Indisponibile', color: 'var(--color-danger)' } :
              availability.label === 'Rientro controllato' ? { text: 'Rientro guidato', color: 'var(--color-gold)' } :
              availability.label === 'A rischio' ? { text: 'Rischio infortunio', color: 'var(--color-gold)' } :
              null;
            // Fuori dal ruolo naturale: mostra quanto e' familiare la posizione assegnata in campo.
            const slotRole = pos.role as Player['role'];
            const familiarityEntry = slotRole !== player.role ? getRoleFamiliarityEntry(player, slotRole) : null;
            const familiarityBadge = familiarityEntry ? {
              text: ROLE_FAMILIARITY_STATUS_LABELS[familiarityEntry.status],
              color:
                familiarityEntry.status === 'natural' ? 'var(--color-pitch)' :
                familiarityEntry.status === 'competent' ? 'var(--color-lime)' :
                familiarityEntry.status === 'usable' ? 'var(--color-gold)' :
                'var(--color-danger)'
            } : null;

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
                {availabilityBadge && (
                  <span
                    title={availability.reasons[0]}
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      padding: '2px 5px',
                      borderRadius: '999px',
                      color: availabilityBadge.color,
                      background: 'rgba(11,15,20,0.85)',
                      border: `1px solid ${availabilityBadge.color}`,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {availabilityBadge.text}
                  </span>
                )}
                {familiarityBadge && (
                  <span
                    title={`Ruolo assegnato: ${slotRole}. Familiarita' ${Math.round(familiarityEntry!.familiarity)}/100.`}
                    style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: '-6px',
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      padding: '2px 5px',
                      borderRadius: '999px',
                      color: familiarityBadge.color,
                      background: 'rgba(11,15,20,0.85)',
                      border: `1px solid ${familiarityBadge.color}`,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {familiarityBadge.text}
                  </span>
                )}
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

                {/* Horizontal scroll list of bench substitutes (indisponibili esclusi) */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {swappableBenchPlayers.map(p => {
                    const targetSlotRole = currentPositions[swappingStarterIndex]?.role as Player['role'] | undefined;
                    const swapFamiliarity = targetSlotRole && targetSlotRole !== p.role ? getRoleFamiliarityEntry(p, targetSlotRole) : null;
                    return (
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
                      {swapFamiliarity && (
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{ROLE_FAMILIARITY_STATUS_LABELS[swapFamiliarity.status]}</span>
                      )}
                    </button>
                    );
                  })}
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
                onChange={e => handleModuleChange(e.target.value as Tactic['module'])}
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
                {([4, 3, 5] as const).map(defLine => (
                  <optgroup key={defLine} label={`Difesa a ${defLine}`}>
                    {Object.values(FORMATION_LIBRARY).filter(formation => formation.defensiveLine === defLine).map(formation => (
                      <option key={formation.id} value={formation.id}>{formation.label} — {formation.description}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '8px' }}>
                {currentFormationMeta.tags.map(tag => (
                  <span key={tag} className="badge" style={{ fontSize: '0.62rem' }}>{tag}</span>
                ))}
              </div>
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

        {/* T1: Analisi modulo — punti forti/deboli, compatibilita rosa, ruoli critici */}
        <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={16} style={{ color: 'var(--color-lime)' }} />
            Analisi modulo: {currentFormationMeta.label}
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Compatibilità rosa</span>
            <strong style={{
              fontSize: '0.85rem',
              color: formationCompatibility.adaptationRisk === 'low' ? 'var(--color-pitch)' : formationCompatibility.adaptationRisk === 'medium' ? 'var(--color-gold)' : 'var(--color-danger)'
            }}>
              {formationCompatibility.compatibilityScore}% · rischio adattamento {formationCompatibility.adaptationRisk === 'low' ? 'basso' : formationCompatibility.adaptationRisk === 'medium' ? 'medio' : 'alto'}
            </strong>
          </div>
          <div style={{ height: '5px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              width: `${formationCompatibility.compatibilityScore}%`, height: '100%',
              background: formationCompatibility.adaptationRisk === 'low' ? 'var(--color-pitch)' : formationCompatibility.adaptationRisk === 'medium' ? 'var(--color-gold)' : 'var(--color-danger)'
            }} />
          </div>
          {formationCompatibility.missingRoles.length > 0 && (
            <p style={{ fontSize: '0.72rem', color: 'var(--color-danger)', lineHeight: 1.4 }}>
              Ruoli mancanti o scoperti in rosa: {formationCompatibility.missingRoles.join(', ')}.
            </p>
          )}
          {formationCompatibility.keyPlayers.length > 0 && (
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Giocatori chiave:</strong> {formationCompatibility.keyPlayers.join(', ')}.
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
            <div>
              <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-pitch)', marginBottom: '4px' }}>Punti forti</p>
              {currentFormationMeta.strengths.map(item => (
                <p key={item} style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginBottom: '3px' }}>• {item}</p>
              ))}
            </div>
            <div>
              <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-danger)', marginBottom: '4px' }}>Punti deboli</p>
              {currentFormationMeta.weaknesses.map(item => (
                <p key={item} style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginBottom: '3px' }}>• {item}</p>
              ))}
            </div>
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.35, marginTop: '2px' }}>
            Effetto previsto sul match: attacco {tacticalReport.attack}, centrocampo {tacticalReport.midfield}, difesa {tacticalReport.defense}, carico fisico {tacticalReport.fatigueLoad}.
          </p>
        </div>

        {/* T2: preset rapidi — cambiano solo i compiti (duty), mai modulo o ruoli assegnati */}
        <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Preset rapidi</h3>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(Object.keys(INSTRUCTION_PRESET_LABELS) as InstructionPresetId[]).map(preset => (
              <button
                key={preset}
                onClick={() => applyPreset(preset)}
                className="btn-secondary"
                style={{ fontSize: '0.7rem', padding: '7px 10px' }}
              >
                {INSTRUCTION_PRESET_LABELS[preset]}
              </button>
            ))}
          </div>
        </div>

        {/* T2: Impatto tattico — lettura rapida di modulo + istruzioni scelte sui titolari attuali */}
        <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Impatto tattico</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
            {[
              ['Ampiezza', tacticalImpact.wingThreat],
              ['Controllo centrale', tacticalImpact.centralControl],
              ['Pressing', tacticalImpact.pressingPotential],
              ['Rischio transizione', tacticalImpact.defensiveTransitionRisk],
              ['Creazione occasioni', tacticalImpact.chanceCreation],
              ['Solidità difensiva', tacticalImpact.defensiveSolidity],
              ['Fatica prevista', tacticalReport.fatigueLoad]
            ].map(([label, value]) => (
              <div key={label} style={{ padding: '7px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(26,33,42,0.24)', textAlign: 'center' }}>
                <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</p>
                <strong style={{ fontSize: '0.9rem' }}>{value}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* T2: istruzioni per ruolo/slot */}
        <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={16} style={{ color: 'var(--color-pitch)' }} />
            Istruzioni per ruolo
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
            {slotsWithInstructions.map(({ slot, slotId, instruction, assignedPlayer, fit }) => {
              const availableRoles = (Object.keys(PLAYER_INSTRUCTION_ROLE_META) as (keyof typeof PLAYER_INSTRUCTION_ROLE_META)[])
                .filter(roleKey => PLAYER_INSTRUCTION_ROLE_META[roleKey].baseRoles.includes(slot.role));
              // wide_centre_back ha senso solo con difesa a tre (braccetto): resta selezionabile ma
              // segnalato come non consigliato altrove, invece di sparire dalla lista.
              const notRecommended = (roleKey: PlayerInstructionRole) =>
                roleKey === 'wide_centre_back' && currentFormationMeta.defensiveLine !== 3;
              const compatColor = fit && (
                fit.label === 'Ottimo' ? 'var(--color-pitch)' :
                fit.label === 'Buono' ? 'var(--color-lime)' :
                fit.label === 'Adattato' ? 'var(--color-gold)' :
                'var(--color-danger)'
              );
              return (
                <div key={slotId} style={{ padding: '8px 9px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.18)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                      {slot.role} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({assignedPlayer?.name ?? 'slot vuoto'})</span>
                    </span>
                    {fit && (
                      <span style={{ fontSize: '0.64rem', fontWeight: 800, color: compatColor ?? undefined }}>{fit.label} · {fit.score}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      value={instruction.role}
                      onChange={e => updateSlotInstruction(slotId, { role: e.target.value as SlotInstruction['role'] })}
                      style={{ flex: '1 1 160px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '6px', fontSize: '0.7rem', color: 'var(--text-primary)' }}
                    >
                      {availableRoles.map(roleKey => (
                        <option key={roleKey} value={roleKey}>
                          {PLAYER_INSTRUCTION_ROLE_META[roleKey].label}{notRecommended(roleKey) ? ' (non consigliato qui)' : ''}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      {(['defend', 'support', 'attack'] as const).map(duty => (
                        <button
                          key={duty}
                          onClick={() => updateSlotInstruction(slotId, { duty })}
                          style={{
                            padding: '5px 8px',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-light)',
                            cursor: 'pointer',
                            backgroundColor: instruction.duty === duty ? 'var(--color-pitch)' : 'var(--bg-surface-elevated)',
                            color: instruction.duty === duty ? '#042F1A' : 'var(--text-primary)'
                          }}
                        >
                          {duty === 'defend' ? 'Difesa' : duty === 'support' ? 'Supporto' : 'Attacco'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {fit && (fit.label === 'Rischioso' || fit.label === 'Fuori ruolo') && (
                    <p style={{ fontSize: '0.64rem', color: 'var(--color-danger)', marginTop: '5px', lineHeight: 1.35 }}>
                      ⚠ {fit.reasons[0]}
                    </p>
                  )}
                  {notRecommended(instruction.role) && (
                    <p style={{ fontSize: '0.64rem', color: 'var(--color-gold)', marginTop: '5px', lineHeight: 1.35 }}>
                      Ruolo pensato per una difesa a tre: qui il suo effetto è ridotto.
                    </p>
                  )}
                </div>
              );
            })}
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
