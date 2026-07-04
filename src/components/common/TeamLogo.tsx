import React, { useState } from 'react';
import { ClubProfile } from '../../types';

interface TeamLogoProps {
  club?: Pick<ClubProfile, 'name' | 'initials' | 'logoUrl' | 'primaryColor' | 'secondaryColor'>;
  initials?: string;
  size?: number;
  rounded?: number;
  highlighted?: boolean;
}

export default function TeamLogo({ club, initials, size = 44, rounded = 10, highlighted = false }: TeamLogoProps) {
  const [failed, setFailed] = useState(false);
  const label = club?.initials ?? initials ?? 'FC';
  const primary = club?.primaryColor ?? '#1E293B';
  const secondary = club?.secondaryColor ?? '#0F172A';

  return (
    <div
      className={`team-logo${highlighted ? ' team-logo-highlighted' : ''}`}
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
        border: highlighted ? '2px solid var(--color-pitch)' : '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: highlighted ? '0 0 15px rgba(16, 185, 129, 0.2)' : '0 8px 18px rgba(0,0,0,0.22)',
        flex: '0 0 auto'
      }}
      aria-label={club?.name ?? label}
      title={club?.name ?? label}
    >
      {club?.logoUrl && !failed ? (
        <img
          src={club.logoUrl}
          alt={club.name}
          onError={() => setFailed(true)}
          style={{
            width: Math.round(size * 0.78),
            height: Math.round(size * 0.78),
            objectFit: 'contain',
            display: 'block'
          }}
        />
      ) : (
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: Math.max(10, Math.round(size * 0.27)),
            fontWeight: 900,
            color: primary === '#F8FAFC' || secondary === '#FFFFFF' ? '#020617' : '#F8FAFC'
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
