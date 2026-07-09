import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, X } from 'lucide-react';
import { ClubFacilitiesState, ClubProfile, ClubStaffState, FacilityType } from '../../types';
import {
  FACILITY_EFFECT_LABELS,
  FACILITY_LABELS,
  getFacility,
  getFacilityUpgradeCost,
  getFacilityUpgradeDurationRounds,
  hasActiveFacilityProject
} from '../../utils/facilities';
import { getClubStaffMember } from '../../utils/staff';
import { ModalPortal, useModalBehavior } from './BaseModal';

interface ClubFacilitiesModalProps {
  clubFacilitiesState: ClubFacilitiesState;
  clubStaffState: ClubStaffState;
  budget: number;
  currentRound: number;
  club: ClubProfile;
  onClose: () => void;
  onUpgrade: (type: FacilityType) => void;
}

const FACILITY_ORDER: FacilityType[] = ['training_centre', 'medical_centre', 'youth_academy', 'scouting_network', 'analysis_department'];

const FACILITY_LINKED_ROLES: Record<FacilityType, Array<'assistant_manager' | 'fitness_coach' | 'head_physio' | 'development_coach' | 'chief_scout'>> = {
  training_centre: ['fitness_coach', 'development_coach'],
  medical_centre: ['head_physio'],
  youth_academy: ['development_coach'],
  scouting_network: ['chief_scout'],
  analysis_department: ['assistant_manager']
};

const formatCurrency = (value: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

export default function ClubFacilitiesModal({ clubFacilitiesState, clubStaffState, budget, currentRound, club, onClose, onUpgrade }: ClubFacilitiesModalProps) {
  const anyActiveProject = hasActiveFacilityProject(clubFacilitiesState);
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
          style={{ width: 'min(700px, calc(100vw - 28px))', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '84vh', overflowY: 'auto' }}
          onClick={event => event.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <div>
              <span className="selection-kicker" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={13} /> Strutture del club
              </span>
              <h3 style={{ marginTop: '6px', fontSize: '1.05rem' }}>Gestisci strutture</h3>
              {anyActiveProject && (
                <p style={{ fontSize: '0.68rem', color: 'var(--color-gold)', marginTop: '4px' }}>
                  Un solo progetto strutturale puo essere attivo alla volta.
                </p>
              )}
            </div>
            <button className="btn-secondary" onClick={onClose} aria-label="Chiudi strutture del club" style={{ width: '34px', height: '34px', padding: 0, justifyContent: 'center' }}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {FACILITY_ORDER.map(type => {
              const facility = getFacility(clubFacilitiesState, type);
              if (!facility) return null;
              const project = facility.activeProject?.status === 'active' ? facility.activeProject : undefined;
              const targetLevel = facility.level + 1;
              const canUpgrade = facility.level < 5 && !anyActiveProject;
              const cost = facility.level < 5 ? getFacilityUpgradeCost(club, targetLevel) : 0;
              const duration = facility.level < 5 ? getFacilityUpgradeDurationRounds(targetLevel) : 0;
              const affordable = budget >= cost;
              const linkedStaffNames = FACILITY_LINKED_ROLES[type]
                .map(role => getClubStaffMember(clubStaffState, role)?.name)
                .filter((name): name is string => Boolean(name))
                .join(', ');
              const progress = project
                ? Math.round(Math.min(99, ((currentRound - project.startedRound) / Math.max(1, project.completedRound - project.startedRound)) * 100))
                : 0;

              return (
                <div key={type} style={{ padding: '10px 12px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                    <strong style={{ fontSize: '0.85rem' }}>{FACILITY_LABELS[type]}</strong>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Livello {facility.level}/5 · Condizione {facility.condition}%</span>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{FACILITY_EFFECT_LABELS[type]}</p>
                  {linkedStaffNames && (
                    <p style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '2px' }}>Staff collegato: {linkedStaffNames}</p>
                  )}

                  {project ? (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--color-pitch)' }} />
                      </div>
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>
                        Progetto verso il livello {project.targetLevel}: {progress}% · {Math.max(0, project.completedRound - currentRound)} giornate rimanenti.
                      </span>
                    </div>
                  ) : facility.level >= 5 ? (
                    <p style={{ fontSize: '0.68rem', color: 'var(--color-pitch)', marginTop: '8px' }}>Livello massimo raggiunto.</p>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', gap: '8px' }}>
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                        Livello {targetLevel}: {formatCurrency(cost)} · circa {duration} giornate
                      </span>
                      <button
                        className="btn-primary"
                        disabled={!canUpgrade || !affordable}
                        onClick={() => onUpgrade(type)}
                        style={{ padding: '4px 10px', fontSize: '0.66rem', opacity: !canUpgrade || !affordable ? 0.45 : 1 }}
                      >
                        {!affordable ? 'Budget insufficiente' : anyActiveProject ? 'Progetto gia attivo' : 'Avvia upgrade'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {clubFacilitiesState.recentFacilityEvents.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Eventi recenti</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {clubFacilitiesState.recentFacilityEvents.slice(0, 5).map((event, index) => (
                  <div key={`${index}-${event.slice(0, 12)}`} style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                    {event}
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
