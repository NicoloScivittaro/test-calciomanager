import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileSignature, X } from 'lucide-react';
import { ClubProfile, ClubWageBudgetState, ContractSquadRole, Player } from '../../types';
import {
  CONTRACT_SQUAD_ROLE_LABELS,
  ApplySignedContractInput,
  buildInitialPlayerContract,
  calculateContractFinancialImpact,
  evaluateContractOffer,
  getContractStatusLabel,
  getPlayerContractDemand,
  inferContractSquadRole,
  toAnnualSalary
} from '../../utils/playerContracts';
import { ModalPortal, useModalBehavior } from './BaseModal';

interface ContractRenewalModalProps {
  player: Player;
  club: ClubProfile;
  wageBudget: ClubWageBudgetState;
  transferBudget: number;
  season: string;
  highestSquadAnnualSalary: number;
  starters: string[];
  bench: string[];
  currentRound: number;
  onClose: () => void;
  onConfirm: (input: ApplySignedContractInput) => void;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

export default function ContractRenewalModal({
  player, club, wageBudget, transferBudget, season, highestSquadAnnualSalary, starters, bench, currentRound, onClose, onConfirm
}: ContractRenewalModalProps) {
  const contract = player.contract ?? buildInitialPlayerContract(player, club, season);
  const context = { starters, bench, round: currentRound };
  const demand = getPlayerContractDemand(player, club, context);
  const squadRole = inferContractSquadRole(player, context);

  const [annualSalary, setAnnualSalary] = useState(demand.demandedAnnualSalary);
  const [years, setYears] = useState(demand.demandedYears);
  const [signingBonus, setSigningBonus] = useState(Math.round(demand.demandedAnnualSalary * 0.08));
  const [agentFee, setAgentFee] = useState(Math.round(demand.demandedAnnualSalary * 0.05));

  const evaluation = evaluateContractOffer(
    player,
    club,
    { annualSalary, years, squadRole, releaseClause: contract.releaseClause },
    wageBudget,
    context,
    highestSquadAnnualSalary
  );
  const impact = calculateContractFinancialImpact(
    { annualSalary, signingBonus, agentFee },
    transferBudget,
    wageBudget,
    toAnnualSalary(player.wage)
  );

  const canConfirm = evaluation.decision === 'accepted' && impact.transferBudgetOk && impact.wageBudgetOk;
  useModalBehavior(true, onClose);

  return (
    <ModalPortal>
    <AnimatePresence>
      <div className="player-profile-backdrop quick" style={{ zIndex: 4500 }} onClick={event => { event.stopPropagation(); onClose(); }}>
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 14 }}
          transition={{ type: 'spring', damping: 24, stiffness: 230 }}
          className="player-profile-card quick"
          style={{ width: 'min(560px, calc(100vw - 28px))', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '84vh', overflowY: 'auto' }}
          onClick={event => event.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <div>
              <span className="selection-kicker" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileSignature size={13} /> Rinnovo contratto
              </span>
              <h3 style={{ marginTop: '6px', fontSize: '1.05rem' }}>{player.name}</h3>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Situazione: {getContractStatusLabel(contract)} · Ruolo: {CONTRACT_SQUAD_ROLE_LABELS[squadRole]}
              </p>
            </div>
            <button className="btn-secondary" onClick={onClose} aria-label="Chiudi rinnovo contratto" style={{ width: '34px', height: '34px', padding: 0, justifyContent: 'center' }}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.72rem' }}>
            <div style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Contratto attuale</span>
              <strong style={{ display: 'block', marginTop: '3px' }}>{formatCurrency(contract.annualSalary)}/anno · {contract.durationYears} anni</strong>
            </div>
            <div style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Richiesta stimata</span>
              <strong style={{ display: 'block', marginTop: '3px' }}>{formatCurrency(demand.demandedAnnualSalary)}/anno · {demand.demandedYears} anni</strong>
            </div>
          </div>

          {demand.reasons.length > 0 && (
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
              Motivazioni: {demand.reasons.join(', ')}.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Stipendio annuo proposto (€)</label>
              <input
                type="number"
                value={annualSalary}
                onChange={event => setAnnualSalary(Math.max(0, Number(event.target.value) || 0))}
                style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.8rem', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Durata (anni)</label>
              <select
                value={years}
                onChange={event => setYears(Number(event.target.value))}
                style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.8rem', color: 'var(--text-primary)' }}
              >
                {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>{y} anni</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bonus firma (una tantum)</label>
                <input
                  type="number"
                  value={signingBonus}
                  onChange={event => setSigningBonus(Math.max(0, Number(event.target.value) || 0))}
                  style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.8rem', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Commissione agente (una tantum)</label>
                <input
                  type="number"
                  value={agentFee}
                  onChange={event => setAgentFee(Math.max(0, Number(event.target.value) || 0))}
                  style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.8rem', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            {contract.releaseClause && (
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Clausola rescissoria informativa: {formatCurrency(contract.releaseClause)} (nessuna attivazione automatica nei flussi di mercato).</p>
            )}
          </div>

          <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.28)', padding: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Costo una tantum (trasferimenti)</span>
              <strong style={{ color: impact.transferBudgetOk ? 'var(--color-pitch)' : 'var(--color-danger)' }}>{formatCurrency(impact.oneOffCost)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginTop: '4px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Impegno annuo (budget stipendi)</span>
              <strong style={{ color: impact.wageBudgetOk ? 'var(--color-pitch)' : 'var(--color-danger)' }}>{formatCurrency(impact.annualCost)}/anno</strong>
            </div>
            <p style={{ fontSize: '0.68rem', marginTop: '6px', color: evaluation.decision === 'accepted' ? 'var(--color-pitch)' : evaluation.decision.startsWith('blocked') ? 'var(--color-danger)' : 'var(--color-gold)' }}>
              {evaluation.message}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
            <button className="btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Annulla</button>
            <button
              className="btn-primary"
              disabled={!canConfirm}
              onClick={() => onConfirm({ annualSalary, years, squadRole, signingBonus, agentFee, releaseClause: contract.releaseClause })}
              style={{ flex: 1, justifyContent: 'center', opacity: canConfirm ? 1 : 0.45 }}
            >
              Conferma rinnovo
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
    </ModalPortal>
  );
}
