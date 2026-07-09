import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BookOpen,
  Flame,
  Heart,
  History,
  Medal,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users
} from 'lucide-react';
import { ClubHistoryEntry, ClubHistoryState, ClubProfile, Player, TeamDNAState, SeasonNarrativeState, Standing, EmotionalNarrativeState, LeagueSystemState } from '../../types';
import TeamLogo from '../common/TeamLogo';
import { TEAM_DNA_DEFINITIONS } from '../../utils/teamDNA';
import { SEASON_CHAPTERS } from '../../utils/seasonNarrative';
import { buildManagerLegacySnapshot } from '../../utils/managerLegacy';
import { NARRATIVE_TYPE_LABELS } from '../../utils/emotionalNarratives';
import { RIVALRY_STATUS_LABELS, RIVALRY_TYPE_LABELS } from '../../utils/clubHistory';

interface ClubHistoryProps {
  history: ClubHistoryState;
  teamName: string;
  clubProfile: ClubProfile;
  players: Player[];
  teamDNA: TeamDNAState;
  seasonNarrative: SeasonNarrativeState;
  standings: Standing[];
  emotionalNarratives: EmotionalNarrativeState;
  leagueSystem: LeagueSystemState | null;
}

const formatImpact = (value: number) => `${Math.round(value)}/100`;

const metricColor = (value: number) => {
  if (value >= 72) return 'var(--color-pitch)';
  if (value >= 48) return 'var(--color-gold)';
  return 'var(--color-danger)';
};

const categoryLabel: Record<string, string> = {
  match: 'Partita',
  transfer: 'Mercato',
  locker: 'Spogliatoio',
  rivalry: 'Rivalita',
  youth: 'Giovani',
  record: 'Record',
  legacy: 'Leggenda',
  coach: 'Allenatore'
};

function HistorySection({
  title,
  icon: Icon,
  items,
  empty,
  tone = 'var(--color-pitch)'
}: {
  title: string;
  icon: React.ElementType;
  items: ClubHistoryEntry[];
  empty: string;
  tone?: string;
}) {
  return (
    <div className="card-premium" style={{ padding: '16px', minHeight: '220px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Icon size={17} style={{ color: tone }} />
        <h3 style={{ fontSize: '0.92rem', fontWeight: 850 }}>{title}</h3>
      </div>

      {items.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.55 }}>{empty}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.slice(0, 4).map(item => (
            <div
              key={item.id}
              style={{
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(26, 33, 42, 0.28)',
                padding: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                <strong style={{ fontSize: '0.8rem', lineHeight: 1.35 }}>{item.title}</strong>
                <span style={{ color: tone, fontSize: '0.68rem', fontWeight: 850 }}>{formatImpact(item.impact)}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.42, marginTop: '4px' }}>{item.subtitle}</p>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block', marginTop: '6px' }}>{item.season}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClubHistory({ history, teamName, clubProfile, players, teamDNA, seasonNarrative, standings, emotionalNarratives, leagueSystem }: ClubHistoryProps) {
  const currentDivision = leagueSystem ? (leagueSystem.clubCompetitionMap[clubProfile.id] ?? 'serie_a') : (clubProfile.division ?? 'serie_a');
  const topMorale = [...players].sort((a, b) => b.morale - a.morale)[0];
  const youngCore = players.filter(player => player.age <= 23).length;
  const latestMemories = history.memories.slice(0, 9);
  const activeDNA = TEAM_DNA_DEFINITIONS[teamDNA.active];
  const rankedDNA = Object.entries(teamDNA.scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const clubStatus =
    teamDNA.reputation >= 84 ? 'Candidata scudetto' :
    teamDNA.reputation >= 76 ? 'Club da Champions' :
    teamDNA.reputation >= 66 ? 'Progetto europeo' :
    teamDNA.reputation >= 52 ? 'Meta classifica' :
    'Lotta salvezza';
  const currentChapter = SEASON_CHAPTERS[seasonNarrative.currentChapter];
  const stakeholderPulse = [...(history.stakeholders ?? [])].sort((a, b) => b.influence - a.influence);
  const narrativeArcs = [...(seasonNarrative.arcs ?? [])]
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return b.heat - a.heat;
    })
    .slice(0, 4);
  const legacy = buildManagerLegacySnapshot(history, players, standings, teamName, teamDNA);
  const emotionalStories = [...(emotionalNarratives?.narratives ?? [])]
    .filter(narrative => narrative.status !== 'conclusa')
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 6);

  return (
    <div className="page-wrapper">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}
      >
        <div
          className="card-premium"
          style={{
            padding: '22px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            alignItems: 'center',
            background: `linear-gradient(135deg, ${clubProfile.primaryColor}26, rgba(18, 23, 30, 0.92))`
          }}
        >
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', minWidth: 0 }}>
            <TeamLogo club={clubProfile} size={70} rounded={16} highlighted />
            <div style={{ minWidth: 0 }}>
              <span className="selection-kicker">
                Memoria carriera · {currentDivision === 'serie_a' ? 'Serie A' : 'Serie B'}
              </span>
              <h2 style={{ fontSize: '1.8rem', lineHeight: 1.05, marginTop: '4px' }}>Storia del Club</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: '8px' }}>
                {teamName} non dimentica: risultati, mercato, giovani, ferite e rivalita restano nella carriera.
              </p>
            </div>
          </div>

          {[
            { label: 'Umore tifosi', value: history.fanMood, icon: Heart },
            { label: 'Spogliatoio', value: history.dressingRoom, icon: Users },
            { label: 'Identita', value: history.identity, icon: Shield }
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '12px', background: 'rgba(11, 15, 20, 0.24)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>
                  <Icon size={14} />
                  {item.label}
                </div>
                <strong style={{ display: 'block', marginTop: '8px', fontSize: '1.35rem', color: metricColor(item.value) }}>{item.value}</strong>
                <div style={{ height: '5px', marginTop: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${item.value}%`, height: '100%', background: metricColor(item.value) }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="card-premium border-gold" style={{ padding: '18px', background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(18,23,30,0.94))' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', alignItems: 'center' }}>
            <div>
              <span className="selection-kicker">Eredita allenatore</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, marginTop: '5px', color: 'var(--color-gold)' }}>{legacy.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.48, marginTop: '7px' }}>{legacy.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                {legacy.badges.map(badge => (
                  <span key={badge} className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--color-gold)' }}>{badge}</span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '58px', height: '58px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245,158,11,0.45)', color: 'var(--color-gold)', fontSize: '1.35rem', fontWeight: 900 }}>
                  {legacy.score}
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.9rem' }}>Quanto il club e diverso per il tuo passaggio</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Derivato da memoria, DNA, mercato, giovani e risultati.</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                {legacy.metrics.map(metric => {
                  const tone =
                    metric.tone === 'positive' ? 'var(--color-pitch)' :
                    metric.tone === 'critical' ? 'var(--color-danger)' :
                    metric.tone === 'warning' ? 'var(--color-gold)' :
                    'var(--text-secondary)';
                  return (
                    <div key={metric.label} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(11,15,20,0.22)', padding: '8px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.64rem', textTransform: 'uppercase', fontWeight: 800 }}>{metric.label}</span>
                      <strong style={{ display: 'block', marginTop: '4px', color: tone, fontSize: '0.82rem' }}>{metric.value}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {stakeholderPulse.length > 0 && (
          <div className="card-premium" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Users size={18} style={{ color: 'var(--color-gold)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 850 }}>Interessi contemporanei</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              {stakeholderPulse.map(stakeholder => (
                <div key={stakeholder.key} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.22)', padding: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                    <strong style={{ fontSize: '0.78rem' }}>{stakeholder.name}</strong>
                    <span style={{ fontSize: '0.68rem', fontWeight: 850, color: metricColor(stakeholder.mood) }}>{stakeholder.mood}</span>
                  </div>
                  <div style={{ height: '5px', marginTop: '7px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ width: `${stakeholder.mood}%`, height: '100%', background: metricColor(stakeholder.mood) }} />
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.66rem', lineHeight: 1.35, marginTop: '7px' }}>
                    {stakeholder.lastEvent
                      ? `${stakeholder.lastDelta && stakeholder.lastDelta > 0 ? '+' : ''}${stakeholder.lastDelta ?? 0}: ${stakeholder.lastEvent}`
                      : stakeholder.interests.slice(0, 2).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px' }}>
          <div className="card-premium" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <History size={18} style={{ color: 'var(--color-pitch)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 850 }}>Timeline viva</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {latestMemories.map(memory => (
                <div
                  key={memory.id}
                  style={{
                    borderLeft: `3px solid ${memory.importance >= 75 ? 'var(--color-gold)' : metricColor(55 + memory.fanImpact)}`,
                    background: 'rgba(26, 33, 42, 0.24)',
                    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                    padding: '10px 12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                    <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--color-pitch)' }}>
                      {categoryLabel[memory.category]}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{memory.dateLabel}</span>
                  </div>
                  <strong style={{ display: 'block', marginTop: '7px', fontSize: '0.84rem' }}>{memory.title}</strong>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.74rem', lineHeight: 1.45, marginTop: '4px' }}>{memory.description}</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '7px', color: 'var(--text-muted)', fontSize: '0.66rem' }}>
                    {memory.score && <span>{memory.score}</span>}
                    <span>Tifosi {memory.fanImpact >= 0 ? '+' : ''}{memory.fanImpact}</span>
                    <span>Spogliatoio {memory.dressingRoomImpact >= 0 ? '+' : ''}{memory.dressingRoomImpact}</span>
                    <span>Forza {memory.strength ?? memory.importance}</span>
                    <span>{memory.persistence ?? 'season'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '14px' }}>
            <div className="card-premium" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Sparkles size={17} style={{ color: activeDNA.color }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 850 }}>DNA attuale</h3>
              </div>
              <strong style={{ display: 'block', fontSize: '1rem', color: activeDNA.color }}>{activeDNA.name}</strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.74rem', lineHeight: 1.45, marginTop: '5px', marginBottom: '12px' }}>
                {activeDNA.description}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div style={{ padding: '10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Leader morale</span>
                  <strong style={{ display: 'block', marginTop: '4px', fontSize: '0.82rem' }}>{topMorale?.name ?? 'Da scoprire'}</strong>
                </div>
                <div style={{ padding: '10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Nucleo U23</span>
                  <strong style={{ display: 'block', marginTop: '4px', fontSize: '0.82rem' }}>{youngCore} giocatori</strong>
                </div>
                <div style={{ padding: '10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Reputazione</span>
                  <strong style={{ display: 'block', marginTop: '4px', fontSize: '0.82rem' }}>{Math.round(teamDNA.reputation)}/100</strong>
                </div>
                <div style={{ padding: '10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Mercato attratto</span>
                  <strong style={{ display: 'block', marginTop: '4px', fontSize: '0.82rem' }}>{Math.round(teamDNA.marketAttraction)}/100</strong>
                </div>
                <div style={{ padding: '10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Stagioni DNA</span>
                  <strong style={{ display: 'block', marginTop: '4px', fontSize: '0.82rem' }}>{teamDNA.seasonsTracked}</strong>
                </div>
                <div style={{ padding: '10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Status club</span>
                  <strong style={{ display: 'block', marginTop: '4px', fontSize: '0.82rem' }}>{clubStatus}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {rankedDNA.map(([key, value]) => {
                  const definition = TEAM_DNA_DEFINITIONS[key as keyof typeof TEAM_DNA_DEFINITIONS];
                  return (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 800 }}>
                        <span>{definition.shortName}</span>
                        <span style={{ color: definition.color }}>{Math.round(value)}</span>
                      </div>
                      <div style={{ height: '4px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', marginTop: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${value}%`, height: '100%', background: definition.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card-premium" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <BookOpen size={17} style={{ color: '#93C5FD' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 850 }}>Capitolo stagione</h3>
              </div>
              <strong style={{ display: 'block', fontSize: '0.9rem' }}>{currentChapter.title}</strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.74rem', lineHeight: 1.45, marginTop: '5px' }}>
                {currentChapter.description}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '10px', fontSize: '0.7rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Pressione <strong style={{ color: 'var(--text-primary)' }}>{seasonNarrative.pressure}</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>Board <strong style={{ color: 'var(--text-primary)' }}>{seasonNarrative.boardTrust}</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>Gruppo <strong style={{ color: 'var(--text-primary)' }}>{seasonNarrative.squadBelief}</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>Tifosi <strong style={{ color: 'var(--text-primary)' }}>{seasonNarrative.fanPatience}</strong></span>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {seasonNarrative.events.slice(0, 3).map(event => (
                  <div key={event.id} style={{ borderLeft: `3px solid ${event.tone === 'positive' ? 'var(--color-pitch)' : event.tone === 'critical' ? 'var(--color-danger)' : event.tone === 'warning' ? 'var(--color-gold)' : 'var(--text-muted)'}`, paddingLeft: '9px' }}>
                    <strong style={{ display: 'block', fontSize: '0.76rem' }}>{event.title}</strong>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', lineHeight: 1.35, marginTop: '2px' }}>{event.consequence}</p>
                    {(event.causes?.length ?? 0) > 0 && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.64rem', lineHeight: 1.35, marginTop: '3px' }}>
                        Cause: {(event.causes ?? []).slice(0, 2).join(' / ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {seasonNarrative.worldSignals?.length > 0 && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem', textTransform: 'uppercase', fontWeight: 800 }}>Segnali attivi</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '7px' }}>
                    {seasonNarrative.worldSignals.slice(0, 3).map(signal => (
                      <div key={signal.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', fontSize: '0.68rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{signal.label}</span>
                        <strong style={{ color: metricColor(signal.intensity) }}>{signal.intensity}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {narrativeArcs.length > 0 && (
              <div className="card-premium" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Sparkles size={17} style={{ color: 'var(--color-gold)' }} />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 850 }}>Archi narrativi</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {narrativeArcs.map(arc => (
                    <div key={arc.id} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.22)', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                        <strong style={{ fontSize: '0.78rem', lineHeight: 1.35 }}>{arc.title}</strong>
                        <span style={{ fontSize: '0.66rem', fontWeight: 850, color: arc.status === 'permanent' ? 'var(--color-danger)' : metricColor(arc.heat) }}>
                          {arc.stage} {arc.heat}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', lineHeight: 1.35, marginTop: '5px' }}>{arc.stakes}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.64rem', lineHeight: 1.35, marginTop: '5px' }}>
                        {arc.outcome ? `Esito: ${arc.outcome}` : arc.history[0] ?? arc.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card-premium" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Flame size={17} style={{ color: 'var(--color-danger)' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 850 }}>Rivalita nate</h3>
              </div>
              {history.rivalries.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.5 }}>Nessuna rivalita viva: derby tesi, gare sporche o trasferimenti delicati la faranno nascere.</p>
              ) : (
                history.rivalries.slice(0, 3).map(rivalry => (
                  <div key={rivalry.id} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 800 }}>
                      <span>{rivalry.opponent}</span>
                      <span style={{ color: metricColor(rivalry.heat) }}>{Math.round(rivalry.heat)}%</span>
                    </div>
                    <div style={{ height: '5px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', marginTop: '5px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${rivalry.heat}%`, background: 'var(--color-danger)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                      <span>{RIVALRY_TYPE_LABELS[rivalry.type]} · {RIVALRY_STATUS_LABELS[rivalry.status]}</span>
                      <span>Rispetto {Math.round(rivalry.respect)}%</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: '5px' }}>{rivalry.reason}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.66rem', marginTop: '3px' }}>
                      Bilancio: {rivalry.wins}V {rivalry.draws}N {rivalry.losses}P · Nata: {rivalry.startedAt}
                      {rivalry.lastMeetingResult && ` · Ultimo scontro: ${rivalry.lastMeetingResult} (${rivalry.lastMeetingSeason})`}
                    </p>
                    {rivalry.memories.slice(0, 3).map((event, index) => (
                      <p key={index} style={{ color: 'var(--text-secondary)', fontSize: '0.66rem', marginTop: '3px', lineHeight: 1.3 }}>• {event}</p>
                    ))}
                    {rivalry.exPlayersInvolved.length > 0 && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.66rem', marginTop: '3px' }}>
                        Ex coinvolti: {rivalry.exPlayersInvolved.join(', ')}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="card-premium" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <BookOpen size={17} style={{ color: 'var(--color-pitch)' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 850 }}>Promesse e fiducia</h3>
              </div>
              {history.promises.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.5 }}>Le promesse ai giocatori compariranno qui quando il sistema contratti/colloqui le usera.</p>
              ) : (
                history.promises.slice(0, 4).map(promise => (
                  <div key={promise.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '0.75rem', marginBottom: '8px' }}>
                    <span>{promise.playerName}</span>
                    <strong>{promise.status}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '14px' }}>
          <HistorySection title="Trofei" icon={Trophy} items={history.trophies} empty="La bacheca della carriera e ancora vuota. Vincere un titolo lo rendera permanente." tone="var(--color-gold)" />
          <HistorySection title="Record" icon={Medal} items={history.records} empty="Rimonte, serie positive e serate speciali finiranno qui." tone="var(--color-lime)" />
          <HistorySection title="Leggende" icon={Star} items={history.legends} empty="Nessuna leggenda nuova e stata scritta oltre ai simboli iniziali." tone="var(--color-gold)" />
          <HistorySection title="Grandi tradimenti" icon={AlertTriangle} items={history.betrayals} empty="Nessuna vendita o scelta ha ancora ferito davvero i tifosi." tone="var(--color-danger)" />
          <HistorySection title="Partite iconiche" icon={Flame} items={history.iconicMatches} empty="Servono rimonte, derby tesi o gare assurde per creare memoria." tone="var(--color-gold)" />
          <HistorySection title="Allenatori passati" icon={BookOpen} items={history.pastCoaches} empty="Il ciclo tecnico e appena iniziato." tone="var(--color-pitch)" />
          <HistorySection title="Giovani lanciati" icon={Users} items={history.launchedYoungsters} empty="Fai giocare giovani veri: se entrano in gare importanti, resteranno qui." tone="var(--color-lime)" />
          <HistorySection title="Migliori acquisti" icon={Sparkles} items={history.bestSignings} empty="Gli acquisti riusciti appariranno dopo le trattative chiuse." tone="var(--color-pitch)" />
          <HistorySection title="Peggiori acquisti" icon={AlertTriangle} items={history.worstSignings} empty="Se strapaghi un giocatore o fai un affare rischioso, la memoria non perdona." tone="var(--color-danger)" />
          <HistorySection title="Cessioni dolorose" icon={Heart} items={history.painfulSales ?? []} empty="Vendere una bandiera, una stella o un futuro capitano lascera una ferita qui." tone="var(--color-danger)" />
          <HistorySection title="Affari redditizi" icon={Medal} items={history.profitableDeals ?? []} empty="Le vendite sopra valore e sostenibili diventeranno patrimonio della societa." tone="var(--color-pitch)" />
          <HistorySection title="Ritorni emozionanti" icon={BookOpen} items={history.emotionalReturns ?? []} empty="Un ex simbolo tornato a casa potra accendere nostalgia o rimpianto." tone="var(--color-gold)" />
          <HistorySection title="Acquisti nuova era" icon={Sparkles} items={history.newEraSignings ?? []} empty="I colpi che cambiano ambizione e identita del club finiranno qui." tone="var(--color-gold)" />

          <div className="card-premium" style={{ padding: '16px', minHeight: '220px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Flame size={17} style={{ color: '#FB7185' }} />
              <h3 style={{ fontSize: '0.92rem', fontWeight: 850 }}>Storie e partite iconiche</h3>
            </div>
            {emotionalStories.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.55 }}>
                Favole a sorpresa, sconfitte eroiche, eroi inattesi e riscatti: quando nasceranno, resteranno qui.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {emotionalStories.map(story => (
                  <div
                    key={story.id}
                    style={{
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(26, 33, 42, 0.28)',
                      padding: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#FB7185', textTransform: 'uppercase' }}>
                        {NARRATIVE_TYPE_LABELS[story.type]}
                      </span>
                      <span style={{ color: '#FB7185', fontSize: '0.68rem', fontWeight: 850 }}>{formatImpact(story.importance)}</span>
                    </div>
                    <strong style={{ fontSize: '0.8rem', lineHeight: 1.35 }}>{story.title}</strong>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.42, marginTop: '4px' }}>{story.description}</p>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block', marginTop: '6px' }}>
                      {story.playerName ?? story.club} · {story.stage} · {story.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
