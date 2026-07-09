import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GraduationCap, X } from 'lucide-react';
import { ClubFacilitiesState, ClubStaffState, Player, YouthAcademyState } from '../../types';
import { getActiveYouthPlayers, getYouthPotentialLabel } from '../../utils/youthAcademy';
import { DEVELOPMENT_TREND_LABELS } from '../../utils/playerDevelopment';
import { ModalPortal, useModalBehavior } from './BaseModal';

interface YouthAcademyModalProps {
  players: Player[];
  youthAcademyState: YouthAcademyState;
  clubStaffState: ClubStaffState;
  clubFacilitiesState: ClubFacilitiesState;
  onClose: () => void;
  onPromote: (player: Player) => void;
  onRelease: (player: Player) => void;
}

type FilterKey = 'all' | 'observe' | 'candidates';

const LOCAL_CONNECTION_LABELS: Record<string, string> = {
  local: 'Legame locale',
  regional: 'Legame regionale',
  national: 'Legame nazionale',
  international: 'Profilo internazionale'
};

const STATUS_LABELS: Record<string, string> = {
  prospect: 'Da osservare',
  high_potential: 'Alto potenziale',
  promotion_candidate: 'Candidato promozione',
  promoted: 'Promosso',
  released: 'Rilasciato'
};

export default function YouthAcademyModal({ players, youthAcademyState, clubStaffState, clubFacilitiesState, onClose, onPromote, onRelease }: YouthAcademyModalProps) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [confirmingReleaseId, setConfirmingReleaseId] = useState<string | null>(null);

  const active = getActiveYouthPlayers(players, youthAcademyState);
  const filtered = active.filter(player => {
    const status = player.youthProfile?.academyStatus;
    if (filter === 'candidates') return status === 'promotion_candidate' || status === 'high_potential';
    if (filter === 'observe') return status === 'prospect';
    return true;
  });
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
          style={{ width: 'min(760px, calc(100vw - 28px))', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '84vh', overflowY: 'auto' }}
          onClick={event => event.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <div>
              <span className="selection-kicker" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GraduationCap size={13} /> Settore giovanile
              </span>
              <h3 style={{ marginTop: '6px', fontSize: '1.05rem' }}>Vivaio ({active.length} prospetti)</h3>
            </div>
            <button className="btn-secondary" onClick={onClose} aria-label="Chiudi settore giovanile" style={{ width: '34px', height: '34px', padding: 0, justifyContent: 'center' }}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {([['all', 'Tutti'], ['observe', 'Da osservare'], ['candidates', 'Candidati promozione']] as [FilterKey, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="btn-secondary"
                style={{
                  padding: '6px 10px',
                  fontSize: '0.68rem',
                  background: filter === key ? 'rgba(16,185,129,0.16)' : undefined,
                  borderColor: filter === key ? 'var(--color-pitch)' : undefined
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.length === 0 && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', padding: '18px' }}>
                Nessun prospetto in questa vista.
              </p>
            )}
            {filtered.map(player => {
              const profile = player.youthProfile!;
              const potentialLabel = getYouthPotentialLabel(player, clubStaffState, clubFacilitiesState);
              const trendLabel = player.developmentProfile ? DEVELOPMENT_TREND_LABELS[player.developmentProfile.trend] : 'Stabile';
              const canPromote = player.age >= 16 && (profile.academyStatus === 'promotion_candidate' || profile.academyStatus === 'high_potential');
              const lastReport = youthAcademyState.recentReports.find(r => r.playerId === player.id);

              return (
                <div key={player.id} style={{ padding: '10px 12px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                    <strong style={{ fontSize: '0.85rem' }}>{player.name}</strong>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{player.age} anni · {player.role}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px', fontSize: '0.68rem' }}>
                    <span style={{ color: 'var(--color-gold)', fontWeight: 800 }}>{STATUS_LABELS[profile.academyStatus]}</span>
                    <span style={{ color: 'var(--color-pitch)' }}>{potentialLabel}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Trend: {trendLabel}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{LOCAL_CONNECTION_LABELS[profile.localConnection]}</span>
                  </div>
                  {lastReport && (
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.35 }}>{lastReport.summary}</p>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      className="btn-primary"
                      disabled={!canPromote}
                      onClick={() => onPromote(player)}
                      style={{ padding: '5px 10px', fontSize: '0.66rem', opacity: canPromote ? 1 : 0.4 }}
                    >
                      Promuovi in prima squadra
                    </button>
                    {confirmingReleaseId === player.id ? (
                      <>
                        <button
                          className="btn-secondary"
                          onClick={() => { onRelease(player); setConfirmingReleaseId(null); }}
                          style={{ padding: '5px 10px', fontSize: '0.66rem', color: 'var(--color-danger)' }}
                        >
                          Conferma rilascio
                        </button>
                        <button className="btn-secondary" onClick={() => setConfirmingReleaseId(null)} style={{ padding: '5px 10px', fontSize: '0.66rem' }}>
                          Annulla
                        </button>
                      </>
                    ) : (
                      <button className="btn-secondary" onClick={() => setConfirmingReleaseId(player.id)} style={{ padding: '5px 10px', fontSize: '0.66rem' }}>
                        Rilascia
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
    </ModalPortal>
  );
}
