import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldCheck, X } from 'lucide-react';
import { ClubStaffRole, ClubStaffState } from '../../types';
import { CLUB_STAFF_ROLE_LABELS, canHireClubStaff, describeStaffCandidateComparison, getClubStaffMember } from '../../utils/staff';
import { ModalPortal, useModalBehavior } from './BaseModal';

interface ClubStaffModalProps {
  clubStaffState: ClubStaffState;
  budget: number;
  currentRound: number;
  onClose: () => void;
  onHire: (role: ClubStaffRole, candidateId: string) => void;
}

const ROLE_ORDER: ClubStaffRole[] = ['assistant_manager', 'fitness_coach', 'head_physio', 'development_coach', 'chief_scout'];

const formatCurrency = (value: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

export default function ClubStaffModal({ clubStaffState, budget, currentRound, onClose, onHire }: ClubStaffModalProps) {
  const [selectedRole, setSelectedRole] = useState<ClubStaffRole>('assistant_manager');
  const canHire = canHireClubStaff(clubStaffState, currentRound);
  const current = getClubStaffMember(clubStaffState, selectedRole);
  const candidates = clubStaffState.candidatePool.filter(c => c.role === selectedRole);
  useModalBehavior(true, onClose);

  return (
    <ModalPortal>
    <AnimatePresence>
      <div
        className="player-profile-backdrop quick"
        style={{ zIndex: 4400 }}
        onClick={event => { event.stopPropagation(); onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 14 }}
          transition={{ type: 'spring', damping: 24, stiffness: 230 }}
          className="player-profile-card quick"
          style={{ width: 'min(680px, calc(100vw - 28px))', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '84vh', overflowY: 'auto' }}
          onClick={event => event.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <div>
              <span className="selection-kicker" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={13} /> Staff del club
              </span>
              <h3 style={{ marginTop: '6px', fontSize: '1.05rem' }}>Gestisci staff</h3>
              {!canHire && (
                <p style={{ fontSize: '0.68rem', color: 'var(--color-gold)', marginTop: '4px' }}>
                  Nessuna sostituzione staff possibile prima della giornata {(clubStaffState.lastHireRound ?? 0) + 4}.
                </p>
              )}
            </div>
            <button className="btn-secondary" onClick={onClose} aria-label="Chiudi staff del club" style={{ width: '34px', height: '34px', padding: 0, justifyContent: 'center' }}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {ROLE_ORDER.map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className="btn-secondary"
                style={{
                  padding: '6px 10px',
                  fontSize: '0.68rem',
                  background: selectedRole === role ? 'rgba(16,185,129,0.16)' : undefined,
                  borderColor: selectedRole === role ? 'var(--color-pitch)' : undefined
                }}
              >
                {CLUB_STAFF_ROLE_LABELS[role]}
              </button>
            ))}
          </div>

          {current && (
            <div style={{ padding: '10px 12px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong style={{ fontSize: '0.85rem' }}>{current.name}</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Titolare · qualita {current.overall}</span>
              </div>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Stile: {current.workStyle} · Reputazione {current.reputation} · In carica dalla stagione {current.joinedSeason}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Candidati disponibili</span>
            {candidates.map(candidate => {
              const affordable = budget >= candidate.seasonalCost;
              return (
                <div
                  key={candidate.id}
                  className="btn-secondary"
                  style={{ textAlign: 'left', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', padding: '10px 12px', cursor: 'default' }}
                >
                  <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                    <strong style={{ fontSize: '0.8rem' }}>{candidate.name}</strong>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Qualita {candidate.overall}</span>
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                    {describeStaffCandidateComparison(current, candidate)}
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.66rem', marginTop: '2px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Costo ingaggio: {formatCurrency(candidate.seasonalCost)}</span>
                    <button
                      className="btn-primary"
                      disabled={!canHire || !affordable}
                      onClick={() => onHire(selectedRole, candidate.id)}
                      style={{ padding: '4px 10px', fontSize: '0.66rem', opacity: !canHire || !affordable ? 0.45 : 1 }}
                    >
                      {affordable ? 'Assumi' : 'Budget insufficiente'}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>

          {clubStaffState.recentReports.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Report recenti</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {clubStaffState.recentReports.slice(0, 5).map(report => (
                  <div key={report.id} style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{report.title}</strong> ({CLUB_STAFF_ROLE_LABELS[report.role]}, {report.staffName}) — {report.detail}
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
    </ModalPortal>
  );
}
