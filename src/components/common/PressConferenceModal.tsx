import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, X } from 'lucide-react';
import { Journalist, PressConference } from '../../types';
import { ModalPortal, useModalBehavior } from './BaseModal';

interface PressConferenceModalProps {
  conference: PressConference;
  journalist?: Journalist;
  onAnswer: (optionId: string) => void;
  onClose: () => void;
}

const toneColor = (tone: string) => (
  tone === 'aggressivo' ? 'var(--color-danger)' :
  tone === 'onesto' ? 'var(--color-pitch)' :
  tone === 'difensivo' ? 'var(--color-gold)' :
  'var(--text-secondary)'
);

export default function PressConferenceModal({ conference, journalist, onAnswer, onClose }: PressConferenceModalProps) {
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
          style={{ width: 'min(560px, calc(100vw - 28px))', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '84vh', overflowY: 'auto' }}
          onClick={event => event.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <div>
              <span className="selection-kicker" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mic size={13} /> Conferenza stampa
              </span>
              <h3 style={{ marginTop: '6px', fontSize: '1.05rem' }}>{journalist?.name ?? 'Giornalista'}</h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{journalist?.outlet}</p>
            </div>
            <button className="btn-secondary" onClick={onClose} aria-label="Chiudi conferenza stampa" style={{ width: '34px', height: '34px', padding: 0, justifyContent: 'center' }}>
              <X size={15} />
            </button>
          </div>

          <div style={{ padding: '10px 12px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.03)' }}>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{conference.context}</p>
            <p style={{ fontSize: '0.86rem', fontWeight: 700, lineHeight: 1.4 }}>{conference.question}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {conference.options.map(option => (
              <button
                key={option.id}
                onClick={() => onAnswer(option.id)}
                className="btn-secondary"
                style={{ textAlign: 'left', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', padding: '10px 12px' }}
              >
                <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                  <strong style={{ fontSize: '0.8rem' }}>{option.label}</strong>
                  <span style={{ fontSize: '0.64rem', fontWeight: 800, color: toneColor(option.tone), textTransform: 'uppercase' }}>{option.tone}</span>
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>{option.previewNote}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
    </ModalPortal>
  );
}
