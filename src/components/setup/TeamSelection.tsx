import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Building2, Flag, Gauge, MapPin, Shield, Target, Trophy, Users, Wallet } from 'lucide-react';
import { ClubProfile } from '../../types';
import TeamLogo from '../common/TeamLogo';
import ClubInfoModal from '../common/ClubInfoModal';

interface TeamSelectionProps {
  clubs: ClubProfile[];
  managerName: string;
  onSelect: (club: ClubProfile) => void;
}

const difficultyColors: Record<ClubProfile['difficulty'], string> = {
  Facile: 'var(--color-pitch)',
  Media: 'var(--color-lime)',
  Difficile: 'var(--color-gold)',
  Estrema: 'var(--color-danger)'
};

export default function TeamSelection({ clubs, managerName, onSelect }: TeamSelectionProps) {
  const [selectedId, setSelectedId] = useState(clubs[0]?.id ?? '');
  const [infoClub, setInfoClub] = useState<ClubProfile | null>(null);
  const selectedClub = clubs.find(club => club.id === selectedId) ?? clubs[0];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatCompactCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  };

  const formatNumber = (value: number) => new Intl.NumberFormat('it-IT').format(value);

  return (
    <main className="team-selection-shell">
      <div className="team-selection-bg" />

      <section className="team-selection-hero">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <span className="selection-kicker">Nuova carriera</span>
          <h1>Scegli la tua squadra, Mister {managerName}</h1>
          <p>
            Ogni società parte con pressione, budget e obiettivi diversi. Scegli una piazza, accetta il mandato
            della dirigenza e comincia la stagione.
          </p>
        </motion.div>
      </section>

      <section className="team-selection-layout">
        <motion.div
          className="club-grid"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          {clubs.map((club) => {
            const isSelected = club.id === selectedClub.id;

            return (
              <button
                key={club.id}
                className={`club-choice-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedId(club.id)}
                style={{
                  borderColor: isSelected ? club.primaryColor : 'var(--border-light)',
                  background: isSelected
                    ? `linear-gradient(135deg, ${club.primaryColor}24 0%, rgba(18, 23, 30, 0.96) 74%)`
                    : 'rgba(18, 23, 30, 0.72)'
                }}
              >
                <TeamLogo club={club} size={48} rounded={10} highlighted={isSelected} />
                <div className="club-card-copy">
                  <div>
                    <h3>{club.name}</h3>
                    <span>{club.city}</span>
                  </div>
                  <p>{club.objective}</p>
                </div>
                <div className="club-card-meta">
                  <span>{formatCompactCurrency(club.transferBudget)}</span>
                  <span style={{ color: difficultyColors[club.difficulty] }}>{club.difficulty}</span>
                </div>
              </button>
            );
          })}
        </motion.div>

        <motion.aside
          key={selectedClub.id}
          className="club-detail-panel"
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            borderColor: `${selectedClub.primaryColor}80`,
            boxShadow: `0 0 32px ${selectedClub.primaryColor}18`
          }}
        >
          <div className="club-detail-top">
            <TeamLogo club={selectedClub} size={72} rounded={16} highlighted />
            <div>
              <span className="selection-kicker">Contratto pronto</span>
              <h2>{selectedClub.name}</h2>
              <p>{selectedClub.highlight}</p>
            </div>
          </div>

          <div className="club-detail-stats">
            <div>
              <MapPin size={16} />
              <span>Stadio</span>
              <strong>{selectedClub.stadium}</strong>
            </div>
            <div>
              <Users size={16} />
              <span>Capienza</span>
              <strong>{formatNumber(selectedClub.stadiumCapacity)}</strong>
            </div>
            <div>
              <Wallet size={16} />
              <span>Fondi mercato</span>
              <strong>{formatCurrency(selectedClub.transferBudget)}</strong>
            </div>
            <div>
              <Building2 size={16} />
              <span>Proprietà</span>
              <strong>{selectedClub.ownership}</strong>
            </div>
            {selectedClub.coach && (
              <div>
                <Trophy size={16} />
                <span>Allenatore</span>
                <strong>{selectedClub.coach.name}{selectedClub.coach.overall ? ` (${selectedClub.coach.overall})` : ''}</strong>
              </div>
            )}
          </div>

          <div className="club-mission-card">
            <div>
              <Target size={18} />
              <span>Obiettivo stagionale</span>
            </div>
            <strong>{selectedClub.objective}</strong>
            <p>{selectedClub.boardPromise}</p>
          </div>

          <div className="club-detail-list">
            <div>
              <Shield size={15} />
              <span>Identità tattica</span>
              <strong>{selectedClub.playStyle}</strong>
            </div>
            <div>
              <Flag size={15} />
              <span>Settore giovanile</span>
              <strong>{selectedClub.academy}</strong>
            </div>
            <div>
              <Gauge size={15} />
              <span>Pressione ambiente</span>
              <strong>{selectedClub.pressure}/100</strong>
            </div>
            <div>
              <Trophy size={15} />
              <span>Difficoltà carriera</span>
              <strong style={{ color: difficultyColors[selectedClub.difficulty] }}>{selectedClub.difficulty}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '18px' }}>
            <button
              className="btn-secondary"
              onClick={() => setInfoClub(selectedClub)}
              style={{ width: '100%', justifyContent: 'center', padding: '13px 18px' }}
            >
              <Users size={16} />
              Vedi scheda club e rosa
            </button>

            <button className="btn-primary start-career-button" onClick={() => onSelect(selectedClub)} style={{ marginTop: 0 }}>
              Inizia con {selectedClub.shortName}
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.aside>
      </section>
      <ClubInfoModal club={infoClub} onClose={() => setInfoClub(null)} />
    </main>
  );
}
