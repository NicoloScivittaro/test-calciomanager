import React, { useState } from 'react';
import { ReplayFrame } from '../../types';

export interface PitchTeamVisual {
  primary: string;
  secondary: string;
  label: string;
}

export interface PitchOverlayState {
  passes: boolean;
  pressing: boolean;
  defensiveLine: boolean;
  width: boolean;
  depth: boolean;
  names: boolean;
}

interface PitchRendererProps {
  frame: ReplayFrame | null;
  teamA: PitchTeamVisual;
  teamB: PitchTeamVisual;
  overlays: PitchOverlayState;
  selectedPlayerId?: string | null;
  onSelectPlayer?: (playerId: string | null) => void;
  // Stato autoritativo della partita reale (MatchCenter): il renderer non decide mai nulla da solo,
  // riceve questi dati solo per restare coerente con cio' che il motore ufficiale ha gia' stabilito.
  authoritativeMatchStatus?: 'preview' | 'playing' | 'finished';
  authoritativeMinute?: number;
  isAuthoritativeMatchRunning?: boolean;
  isAuthoritativePaused?: boolean;
  isMatchFinished?: boolean;
}

const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 50);

// Vista dall'alto puramente visiva: nessun calcolo qui decide risultati o statistiche,
// disegna soltanto il frame (gia' interpolato) che riceve in props.
export default function PitchRenderer({ frame, teamA, teamB, overlays, selectedPlayerId, onSelectPlayer, isMatchFinished }: PitchRendererProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!frame) {
    return (
      <div className="pitch-viewer-empty" role="status">
        In attesa di dati di partita per generare la visualizzazione.
      </div>
    );
  }

  const teamVisual = (teamId: 'user' | 'opponent') => (teamId === 'user' ? teamA : teamB);

  const possessionPlayers = frame.possessionTeamId
    ? frame.players.filter(player => player.teamId === frame.possessionTeamId)
    : [];
  const widthRange = possessionPlayers.length
    ? { min: Math.min(...possessionPlayers.map(p => p.position.x)), max: Math.max(...possessionPlayers.map(p => p.position.x)) }
    : null;
  const depthY = possessionPlayers.length ? average(possessionPlayers.map(p => p.position.y)) : null;

  const passFrom = frame.passFromPlayerId ? frame.players.find(p => p.playerId === frame.passFromPlayerId) : undefined;
  const passTo = frame.passToPlayerId ? frame.players.find(p => p.playerId === frame.passToPlayerId) : undefined;
  const pressers = overlays.pressing ? frame.players.filter(player => player.isPressing).slice(0, 4) : [];

  const stripes = Array.from({ length: 8 }, (_, index) => index);

  return (
    <div className="pitch-viewer">
      <svg className="pitch-viewer-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Visualizzazione tattica della partita${isMatchFinished ? ' (finale)' : ''}`}>
        <defs>
          <marker id="pitch-pass-arrow" markerWidth="4" markerHeight="4" refX="3.4" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill="#F8FAFC" />
          </marker>
        </defs>

        <rect x="0" y="0" width="100" height="100" className="pitch-grass-base" />
        {stripes.map(index => (
          <rect
            key={index}
            x="0"
            y={index * (100 / stripes.length)}
            width="100"
            height={100 / stripes.length}
            className={index % 2 === 0 ? 'pitch-grass-stripe-a' : 'pitch-grass-stripe-b'}
          />
        ))}

        <g className="pitch-lines">
          <rect x="2" y="2" width="96" height="96" />
          <line x1="2" y1="50" x2="98" y2="50" />
          <circle cx="50" cy="50" r="9" />
          <circle cx="50" cy="50" r="0.7" className="pitch-spot" />
          <rect x="26" y="2" width="48" height="16" />
          <rect x="38" y="2" width="24" height="6" />
          <circle cx="50" cy="14" r="0.6" className="pitch-spot" />
          <rect x="26" y="82" width="48" height="16" />
          <rect x="38" y="92" width="24" height="6" />
          <circle cx="50" cy="86" r="0.6" className="pitch-spot" />
        </g>

        {overlays.width && widthRange && (
          <rect
            x={widthRange.min - 2}
            y="3"
            width={Math.max(2, widthRange.max - widthRange.min + 4)}
            height="94"
            className="pitch-overlay-width"
            style={{ fill: teamVisual(frame.possessionTeamId!).primary }}
          />
        )}

        {overlays.depth && depthY !== null && (
          <line
            x1="38"
            x2="62"
            y1={depthY}
            y2={depthY}
            className="pitch-overlay-depth"
            style={{ stroke: teamVisual(frame.possessionTeamId!).primary }}
          />
        )}

        {overlays.defensiveLine && frame.defensiveLine !== undefined && (
          <line x1="4" y1={frame.defensiveLine} x2="96" y2={frame.defensiveLine} className="pitch-overlay-defensive-line" />
        )}

        {overlays.passes && passFrom && passTo && (
          <line
            x1={passFrom.position.x}
            y1={passFrom.position.y}
            x2={passTo.position.x}
            y2={passTo.position.y}
            className="pitch-overlay-pass"
            markerEnd="url(#pitch-pass-arrow)"
          />
        )}

        {overlays.pressing && pressers.map(player => (
          <circle
            key={`press-${player.playerId}`}
            cx={player.position.x}
            cy={player.position.y}
            r="5.2"
            className="pitch-overlay-pressing"
          />
        ))}

        <circle
          cx={frame.ball.x}
          cy={frame.ball.y}
          r="1.35"
          className="pitch-ball"
        />

        {frame.players.map(player => {
          const visual = teamVisual(player.teamId);
          const isGK = player.role === 'GK';
          const isSelected = selectedPlayerId === player.playerId;
          const isHovered = hoveredId === player.playerId;
          const showName = overlays.names || player.isBallCarrier || player.isHighlighted || isSelected || isHovered;
          const radius = isGK ? 3.1 : 2.85;

          return (
            <g
              key={player.playerId}
              className="pitch-player-marker"
              transform={`translate(${player.position.x}, ${player.position.y})`}
              onClick={() => onSelectPlayer?.(isSelected ? null : player.playerId)}
              onMouseEnter={() => setHoveredId(player.playerId)}
              onMouseLeave={() => setHoveredId(current => (current === player.playerId ? null : current))}
              tabIndex={0}
              role="button"
              aria-label={`${player.shortName ?? player.playerId}, ${visual.label}, numero ${player.jerseyNumber ?? ''}`}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectPlayer?.(isSelected ? null : player.playerId);
                }
              }}
            >
              <title>{`${player.shortName ?? ''} (${visual.label}${player.role ? `, ${player.role}` : ''})`}</title>
              {player.isBallCarrier && <circle r={radius + 1.5} className="pitch-player-carrier-ring" />}
              {(isSelected || isHovered) && <circle r={radius + 1.9} className="pitch-player-selected-ring" />}
              {player.isHighlighted && <circle r={radius + 2.3} className="pitch-player-highlight-ring" />}
              {isGK && <circle r={radius + 0.6} className="pitch-player-gk-ring" />}
              <circle
                r={radius}
                style={{ fill: visual.primary, stroke: isGK ? '#FBBF24' : visual.secondary }}
                className="pitch-player-circle"
              />
              <text className="pitch-player-number" y="1">{player.jerseyNumber ?? ''}</text>
              {showName && (
                <text className="pitch-player-name" y={radius + 3.4}>{player.shortName}</text>
              )}
            </g>
          );
        })}
      </svg>

      {frame.eventLabel && (
        <div className="pitch-viewer-event-banner">{frame.eventLabel}</div>
      )}
    </div>
  );
}
