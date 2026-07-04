import { ClubHistoryState, Player, Standing, TeamDNAState } from '../types';
import { TEAM_DNA_DEFINITIONS } from './teamDNA';

export interface ManagerLegacySnapshot {
  title: string;
  description: string;
  score: number;
  badges: string[];
  metrics: Array<{ label: string; value: string | number; tone: 'positive' | 'warning' | 'critical' | 'neutral' }>;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const buildManagerLegacySnapshot = (
  history: ClubHistoryState,
  players: Player[],
  standings: Standing[],
  teamName: string,
  teamDNA: TeamDNAState
): ManagerLegacySnapshot => {
  const standing = standings.find(row => row.name === teamName);
  const trophies = history.trophies.length;
  const youthLaunched = history.launchedYoungsters.length;
  const painfulSales = history.painfulSales?.length ?? 0;
  const profitableDeals = history.profitableDeals?.length ?? 0;
  const rivalryHeat = history.rivalries.reduce((sum, rivalry) => sum + rivalry.heat, 0);
  const iconicMatches = history.iconicMatches.length;
  const legends = history.legends.length;
  const transformedPlayers = players.filter(player => (
    player.careerMemory.legendScore >= 52
    || player.careerMemory.iconicMoments >= 2
    || player.careerMemory.promisesKept >= 1
  )).length;
  const activeDNA = TEAM_DNA_DEFINITIONS[teamDNA.active];
  const identityScore = clamp(
    history.identity * 0.24
    + history.fanMood * 0.14
    + history.dressingRoom * 0.14
    + teamDNA.reputation * 0.16
    + youthLaunched * 4
    + trophies * 10
    + iconicMatches * 3
    + profitableDeals * 2
    - painfulSales * 2,
    0,
    100
  );
  const badges: string[] = [];

  if (trophies > 0) badges.push('Vincente');
  if (youthLaunched >= 3 || teamDNA.active === 'vivaio') badges.push('Creatore di giovani');
  if (profitableDeals >= 2) badges.push('Architetto sostenibile');
  if (painfulSales >= 2) badges.push('Manager spietato');
  if (history.rivalries.some(rivalry => rivalry.heat >= 75)) badges.push('Costruttore di rivalita');
  if (teamDNA.active === 'pressingFeroce') badges.push('Pressing feroce');
  if (teamDNA.active === 'calcioRomantico') badges.push('Romantico');
  if (teamDNA.active === 'galacticos') badges.push('Ambizione totale');
  if (badges.length === 0) badges.push(activeDNA.shortName);

  const title =
    trophies >= 2 ? 'Costruttore di dinastia' :
    youthLaunched >= 3 ? 'Creatore della generazione del vivaio' :
    profitableDeals > painfulSales && profitableDeals >= 2 ? 'Allenatore che ha salvato il progetto dal mercato' :
    history.rivalries.some(rivalry => rivalry.heat >= 75) ? 'Tecnico delle rivalita accese' :
    teamDNA.active === 'pressingFeroce' ? 'Rivoluzionario del pressing' :
    teamDNA.active === 'vivaio' ? 'Custode del vivaio' :
    'Costruttore di identita';
  const description = `${teamName} oggi porta tracce del tuo passaggio: DNA ${activeDNA.shortName.toLowerCase()}, ${youthLaunched} giovani lanciati, ${profitableDeals} affari redditizi e ${painfulSales} ferite di mercato.`;

  return {
    title,
    description,
    score: Math.round(identityScore),
    badges: badges.slice(0, 5),
    metrics: [
      { label: 'Miglior piazzamento', value: standing ? `${standing.rank} posto` : 'N/D', tone: standing && standing.rank <= 4 ? 'positive' : standing && standing.rank >= 15 ? 'critical' : 'neutral' },
      { label: 'Giovani lanciati', value: youthLaunched, tone: youthLaunched >= 3 ? 'positive' : 'neutral' },
      { label: 'Giocatori trasformati', value: transformedPlayers, tone: transformedPlayers >= 3 ? 'positive' : 'neutral' },
      { label: 'Affari redditizi', value: profitableDeals, tone: profitableDeals >= 2 ? 'positive' : 'neutral' },
      { label: 'Cessioni dolorose', value: painfulSales, tone: painfulSales >= 2 ? 'critical' : painfulSales === 1 ? 'warning' : 'neutral' },
      { label: 'Rivalita create', value: history.rivalries.length, tone: rivalryHeat >= 120 ? 'warning' : 'neutral' },
      { label: 'Partite iconiche', value: iconicMatches, tone: iconicMatches >= 2 ? 'positive' : 'neutral' },
      { label: 'Leggende attive', value: legends, tone: legends >= 3 ? 'positive' : 'neutral' }
    ]
  };
};
