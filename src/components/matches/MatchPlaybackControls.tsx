import React, { useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import { ReplayTimelineMarker } from '../../utils/matchReplayEngine';

export type ReplaySpeed = 0.25 | 0.5 | 0.75 | 1 | 1.5 | 2;

// A 1x un "secondo di partita" del replay dura circa un secondo reale: e' il ritmo di riferimento
// su cui sono calibrate le durate dei segmenti (costruzione, passaggi, tiri, gol...). La velocita'
// scelta dall'utente moltiplica/divide questo ritmo, senza mai alterare le coordinate: cambia solo
// quanto in fretta avanza l'orologio del replay.
const BASE_GAME_SECONDS_PER_REAL_SECOND = 1;
const SPEEDS: ReplaySpeed[] = [0.25, 0.5, 0.75, 1, 1.5, 2];

interface MatchPlaybackControlsProps {
  currentSecond: number;
  durationSeconds: number;
  playing: boolean;
  speed: ReplaySpeed;
  phaseLabel: string;
  possessionLabel: string;
  markers: ReplayTimelineMarker[];
  onTick: (nextSecond: number) => void;
  onTogglePlay: () => void;
  onSpeedChange: (speed: ReplaySpeed) => void;
  onSeekSeconds: (seconds: number) => void;
  onRestart: () => void;
}

// Possiede solo l'orologio di riproduzione (requestAnimationFrame): non decide mai fasi, eventi o risultati,
// si limita a far avanzare il secondo corrente che il genitore usa per interpolare il frame da mostrare.
export default function MatchPlaybackControls({
  currentSecond,
  durationSeconds,
  playing,
  speed,
  phaseLabel,
  possessionLabel,
  markers,
  onTick,
  onTogglePlay,
  onSpeedChange,
  onSeekSeconds,
  onRestart
}: MatchPlaybackControlsProps) {
  const currentSecondRef = useRef(currentSecond);
  useEffect(() => {
    currentSecondRef.current = currentSecond;
  }, [currentSecond]);

  useEffect(() => {
    if (!playing) return undefined;
    let rafId = 0;
    let lastTimestamp: number | null = null;

    const step = (timestamp: number) => {
      if (lastTimestamp === null) lastTimestamp = timestamp;
      const deltaSeconds = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;
      const next = currentSecondRef.current + deltaSeconds * BASE_GAME_SECONDS_PER_REAL_SECOND * speed;

      if (next >= durationSeconds) {
        currentSecondRef.current = durationSeconds;
        onTick(durationSeconds);
        onTogglePlay();
        return;
      }

      currentSecondRef.current = next;
      onTick(next);
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [playing, speed, durationSeconds, onTick, onTogglePlay]);

  const minute = Math.floor(currentSecond / 60);

  const handleNextEvent = () => {
    const next = markers
      .filter(marker => marker.actionStartSecond > currentSecond + 0.5)
      .sort((a, b) => a.actionStartSecond - b.actionStartSecond)[0];
    if (next) onSeekSeconds(next.actionStartSecond);
  };

  return (
    <div className="pitch-controls">
      <div className="pitch-controls-row">
        <button
          type="button"
          className="pitch-control-button"
          onClick={onTogglePlay}
          aria-label={playing ? 'Metti in pausa il replay' : 'Avvia il replay'}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          type="button"
          className="pitch-control-button"
          onClick={onRestart}
          aria-label="Riavvia il replay dall'inizio"
        >
          <RotateCcw size={15} />
        </button>
        <button
          type="button"
          className="pitch-control-button"
          onClick={handleNextEvent}
          disabled={markers.every(marker => marker.actionStartSecond <= currentSecond + 0.5)}
          aria-label="Salta al prossimo evento"
          title="Salta al prossimo evento"
        >
          <SkipForward size={15} />
        </button>

        <span className="pitch-control-possession">Ritmo replay</span>
        <div className="pitch-control-speeds" role="group" aria-label="Velocita di riproduzione">
          {SPEEDS.map(value => (
            <button
              key={value}
              type="button"
              className={`pitch-speed-button${speed === value ? ' active' : ''}`}
              aria-pressed={speed === value}
              aria-label={`Velocita ${value}x`}
              onClick={() => onSpeedChange(value)}
            >
              {value}x
            </button>
          ))}
        </div>

        <div className="pitch-control-readout">
          <strong>{minute}&apos;</strong>
          <span>{phaseLabel}</span>
          <span className="pitch-control-possession">{possessionLabel}</span>
        </div>
      </div>

      <div className="pitch-timeline">
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(durationSeconds))}
          value={Math.round(currentSecond)}
          onChange={event => onSeekSeconds(Number(event.target.value))}
          aria-label="Posizione nel replay"
          className="pitch-timeline-scrubber"
        />
        <div className="pitch-timeline-markers">
          {markers.map(marker => (
            <button
              key={marker.id}
              type="button"
              className={`pitch-timeline-marker pitch-timeline-marker-${marker.kind} pitch-timeline-marker-${marker.team}`}
              style={{ left: `${clampPercent((marker.actionStartSecond / durationSeconds) * 100)}%` }}
              onClick={() => onSeekSeconds(marker.actionStartSecond)}
              aria-label={`Vai al minuto ${marker.minute}: ${marker.label}`}
              title={`${marker.minute}' - ${marker.label}${marker.isVisualOnly ? ' (Episodio tattico del replay)' : ''}`}
            >
              {MARKER_ICONS[marker.kind]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const MARKER_ICONS: Record<ReplayTimelineMarker['kind'], string> = {
  goal: '⚽',
  card: '🟨',
  substitution: '⇄',
  shot: '🎯',
  cross: '➜',
  save: '🧤',
  offside: '🚩',
  free_kick: '⚡',
  penalty: '🥅'
};
